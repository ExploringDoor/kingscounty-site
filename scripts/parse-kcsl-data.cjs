#!/usr/bin/env node
/**
 * Parses pre-fetched KCSL HTML into structured JSON + a JS snippet for index.html.
 *
 * Inputs (fetched separately with curl into /tmp/kcsl/):
 *   - standings-<divid>.html  (one per division)
 *   - all-games.html          (POST result from schedulesearch for all divisions)
 *
 * Outputs:
 *   - data/kcsl-data.json
 *   - data/kcsl-hardcoded.js   (ready-to-paste TEAMS + SCHEDULE_PREVIEW arrays)
 */

const fs = require('fs');
const path = require('path');

const SRC = '/tmp/kcsl';
const OUT = path.join(__dirname, '..', 'data');
fs.mkdirSync(OUT, { recursive: true });

// Division ID → short code → display label. From the LeagueLineup dropdown.
const DIVISIONS = [
  { id: '1057282', code: 'B',  label: 'B Division'  },
  { id: '1057283', code: 'C',  label: 'C Division'  },
  { id: '1045018', code: 'CC', label: 'CC Division' },
  { id: '1057284', code: 'D',  label: 'D Division'  },
  { id: '1057281', code: 'DD', label: 'DD Division' },
];

// Color palette for placeholder team swatches — red/white/blue theme with variety
const COLORS = [
  '#E63946', '#3A86FF', '#F1FAEE', '#457B9D', '#1D3557',
  '#FF006E', '#FB5607', '#FFBE0B', '#8338EC', '#3F88C5',
  '#D62828', '#F77F00', '#FCBF49', '#06A77D', '#005377',
  '#E5383B', '#BA181B', '#660708', '#0077B6', '#90E0EF',
  '#F94144', '#F3722C', '#F8961E', '#F9844A', '#F9C74F',
  '#90BE6D', '#43AA8B', '#4D908E', '#577590', '#277DA1',
  '#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C',
  '#E71D36', '#FF9F1C', '#2EC4B6', '#CBF3F0', '#FFBF69',
];

function toId(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toShort(name) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }
  // Take first letter of each word, max 4
  return words.slice(0, 4).map(w => w[0]).join('').toUpperCase();
}

// --- parse standings HTML → teams per division ------------------
function parseStandings() {
  const teams = [];
  const seen = new Set();
  let colorIdx = 0;

  for (const div of DIVISIONS) {
    const file = path.join(SRC, `standings-${div.id}.html`);
    if (!fs.existsSync(file)) {
      console.warn(`Missing ${file}`);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    // Pattern: teamid=NNNN>TEAMNAME</a>
    const re = /teamid=(\d+)>([^<]+)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const [, teamid, rawName] = m;
      const name = rawName.trim();
      // Skip "BYE - NO GAME" and similar placeholder teams that LeagueLineup
      // uses to mark bye weeks in the standings table.
      if (/^bye\b/i.test(name) || /no game/i.test(name)) continue;
      const id = toId(name);
      // Skip duplicates (a team might appear in both standings + nav link)
      const key = `${div.code}::${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      teams.push({
        id,
        name,
        short: toShort(name),
        div: div.code,
        color: COLORS[colorIdx % COLORS.length],
        leaguelineupTeamId: teamid,
        active: true,
        w: 0, l: 0, ti: 0,
        pct: 0,
        gb: '—',
        streak: '—',
        rs: 0, ra: 0,
        founded: 2000,
        field: 'TBD',
      });
      colorIdx++;
    }
  }
  return teams;
}

// --- parse all-games.html → games list ---------------------------
function parseGames(teams) {
  const file = path.join(SRC, 'all-games.html');
  if (!fs.existsSync(file)) {
    console.warn(`Missing ${file}`);
    return [];
  }
  const html = fs.readFileSync(file, 'utf8');

  // The results table after "Back to Main Schedule Search Page" has rows with
  // columns: Day | Date | Time | Status | Division | Visitors | Home | Location | Officials
  // Extract just the table rows (start after the "tableview" class, stop at </table>)
  const tblStart = html.indexOf('<table Width=100% class="tableview">');
  if (tblStart < 0) return [];
  const tblEnd = html.indexOf('</table>', tblStart);
  const tbl = html.slice(tblStart, tblEnd);

  // Each game row starts with `<tr onMouseOver`, extract everything up to </tr>
  const rowRe = /<tr onMouseOver[^>]*>([\s\S]*?)<\/tr>/g;
  const games = [];
  let m;
  while ((m = rowRe.exec(tbl)) !== null) {
    const row = m[1];
    // Cells: we care about td align=center/left content
    // Extract all <td ...>...</td> blocks
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const cells = [];
    let c;
    while ((c = cellRe.exec(row)) !== null) {
      // Strip HTML tags, entities, trim
      let txt = c[1]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(txt);
    }
    if (cells.length < 8) continue;

    // Expected order: Day | Date | Time | Status | Division | Visitors | Home | Location | [Officials]
    const [day, date, time, status, divRaw, visitors, home, location] = cells;

    if (!day || !date || !visitors || !home) continue;

    // Division raw is like "B 2026 B 2026" — take the first token
    const divCode = (divRaw || '').trim().split(/\s+/)[0] || '';

    // Normalize team names → IDs (match to our teams list)
    const findTeam = (name) => {
      const id = toId(name);
      return teams.find(t => t.id === id && t.div === divCode)
        || teams.find(t => t.id === id)
        || null;
    };

    const awayTeam = findTeam(visitors);
    const homeTeam = findTeam(home);

    const bye = /bye/i.test(visitors) || /bye/i.test(home) || /^bye$/i.test(location.trim());

    // Reformat date: "4/12/2026" → "Apr 12" (matches softball-site's schedule format)
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let prettyDate = date;
    const dm = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dm) prettyDate = `${MONTHS[parseInt(dm[1],10)-1]} ${parseInt(dm[2],10)}`;

    // Reformat time: "9:00am" → "9:00 AM"
    const prettyTime = time.replace(/\s+/g, '')
      .replace(/([ap])m?$/i, ' $1M').toUpperCase()
      .replace(/^(\d)/, '$1').replace(/^(\d):/,'$1:');

    games.push({
      date: prettyDate,
      rawDate: date,
      day,
      time: prettyTime,
      status,
      div: divCode,
      away: awayTeam ? awayTeam.short : visitors,
      awayName: visitors,
      awayId: awayTeam ? awayTeam.id : null,
      home: homeTeam ? homeTeam.short : home,
      homeName: home,
      homeId: homeTeam ? homeTeam.id : null,
      field: location,
      addr: '',
      as: null,
      hs: null,
      done: status === 'F',
      bye,
      wk: 1, // opening weekend — all Spring 2026 games currently scheduled are week 1
    });
  }
  return games;
}

// --- main --------------------------------------------------------
const teams = parseStandings();
const games = parseGames(teams);

console.log(`Parsed ${teams.length} teams across ${DIVISIONS.length} divisions`);
const perDiv = {};
teams.forEach(t => { perDiv[t.div] = (perDiv[t.div] || 0) + 1; });
console.log('Teams per division:', perDiv);
console.log(`Parsed ${games.length} games`);

// Write raw JSON
fs.writeFileSync(
  path.join(OUT, 'kcsl-data.json'),
  JSON.stringify({ divisions: DIVISIONS, teams, games }, null, 2)
);

// Write ready-to-paste JS snippet (matches softball-site's TEAMS + SCHEDULE_PREVIEW shape)
const teamsJs = teams.map(t => {
  const { leaguelineupTeamId, ...pub } = t;
  const entries = Object.entries(pub).map(([k, v]) => {
    const key = /^[a-z_$][a-z0-9_$]*$/i.test(k) ? k : JSON.stringify(k);
    return `${key}:${JSON.stringify(v)}`;
  }).join(',');
  return `  {${entries}}`;
}).join(',\n');

const gamesJs = games.map(g => {
  const entries = Object.entries(g).map(([k, v]) => {
    const key = /^[a-z_$][a-z0-9_$]*$/i.test(k) ? k : JSON.stringify(k);
    return `${key}:${JSON.stringify(v)}`;
  }).join(',');
  return `    {${entries}}`;
}).join(',\n');

const divsJs = DIVISIONS.map(d => `  {code:${JSON.stringify(d.code)},label:${JSON.stringify(d.label)}}`).join(',\n');

const snippet = `// Generated by scripts/parse-kcsl-data.js — do not edit by hand.
// Source: LeagueLineup.com/welcome.asp?url=kingscountysoftball
// Run: node scripts/parse-kcsl-data.js

const KCSL_DIVISIONS = [
${divsJs}
];

const KCSL_TEAMS = [
${teamsJs}
];

const KCSL_SCHEDULE_PREVIEW = [
${gamesJs}
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KCSL_DIVISIONS, KCSL_TEAMS, KCSL_SCHEDULE_PREVIEW };
}
`;

fs.writeFileSync(path.join(OUT, 'kcsl-hardcoded.js'), snippet);
console.log(`Wrote ${path.join(OUT, 'kcsl-data.json')}`);
console.log(`Wrote ${path.join(OUT, 'kcsl-hardcoded.js')}`);
