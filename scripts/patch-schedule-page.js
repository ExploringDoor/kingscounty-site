#!/usr/bin/env node
/**
 * Surgery on schedule.html: swap DVSL hardcoded data for KCSL equivalents
 * and inject a division filter bar above the Scores/Schedule tabs.
 *
 * Idempotent — bails if the KCSL marker is present.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'schedule.html');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'kcsl-data.json'), 'utf8'));

let html = fs.readFileSync(FILE, 'utf8');

const MARKER = '<!-- KCSL DIVISION FILTER -->';
if (html.includes(MARKER)) { console.log('Already patched — skipping'); process.exit(0); }

// --- Build KCSL TEAMS array string ---
const teamsJs = DATA.teams.map(t => {
  const obj = {
    id: t.id, name: t.name, short: t.short, div: t.div, color: t.color,
    w: 0, l: 0, pct: 0, gb: '—', streak: '—', rs: 0, ra: 0,
    founded: 2000, field: 'TBD',
  };
  return '  ' + JSON.stringify(obj).replace(/"(\w+)":/g, '$1:');
}).join(',\n');

// --- Build KCSL weeks array (opening weekend only, since that's all LL has published) ---
// The existing renderer expects: { wk, date, games:[{day,field,away,home, ... }] }
// day is 'sun'/'mon'/'tue'/etc., away/home are team short codes.
const kcslGames = DATA.games
  .filter(g => !g.bye)
  .map(g => ({
    day: (g.day || '').toLowerCase().slice(0, 3),
    field: (g.field || 'TBD').replace(/\s*\(.*\)$/, '').trim(), // strip parenthetical
    away: g.away,
    home: g.home,
    div: g.div,
  }));

const kcslWeeks = [
  { wk: 1, date: 'April 12', games: kcslGames },
  { wk: 2, date: 'April 19', games: [] },
  { wk: 3, date: 'April 26', games: [] },
  { wk: 4, date: 'May 3',    games: [] },
  { wk: 5, date: 'May 10',   games: [] },
  { wk: 6, date: 'May 17',   games: [] },
];

const weeksJs = kcslWeeks.map(w => {
  const games = w.games.map(g =>
    '    ' + JSON.stringify(g).replace(/"(\w+)":/g, '$1:')
  ).join(',\n');
  return `  { wk:${JSON.stringify(w.wk)}, date:${JSON.stringify(w.date)}, games:[${games ? '\n'+games+'\n  ' : ''}] }`;
}).join(',\n');

// --- Replace TEAMS block ---
html = html.replace(
  /const TEAMS = \[[\s\S]*?^\];/m,
  `const TEAMS = [\n${teamsJs}\n];`
);

// --- Replace HIST_TEAMS block with empty ---
html = html.replace(
  /\/\/ All historical KCSL teams[\s\S]*?const HIST_TEAMS = \[[\s\S]*?^\];/m,
  '// No historical KCSL team data yet\nconst HIST_TEAMS = [];'
);

// --- Replace PLAYERS block with empty (safe — the page treats an empty PLAYERS array gracefully) ---
html = html.replace(
  /const PLAYERS = \[[\s\S]*?^\];/m,
  'const PLAYERS = []; // KCSL player stats not tracked yet'
);

// --- Replace weeks block ---
html = html.replace(
  /const weeks = \[[\s\S]*?^\];/m,
  `const weeks = [\n${weeksJs}\n];`
);

// --- Clear stale DVSL demo data so abbreviations don't leak into the UI ---
html = html.replace(
  /const RECAPS = \[[\s\S]*?^\];/m,
  'const RECAPS = [];'
);
html = html.replace(
  /const PITCHER_STATS = \{[\s\S]*?^\};/m,
  'const PITCHER_STATS = {};'
);
html = html.replace(
  /const STAR_NAMES = \{[\s\S]*?^\};/m,
  'const STAR_NAMES = {};'
);
html = html.replace(
  /const LINEUP = \[[\s\S]*?^\];/m,
  'const LINEUP = [];'
);

// --- Point CURRENT_WK_IDX at Week 1 (opening weekend) instead of old week 9 ---
html = html.replace(
  /const CURRENT_WK_IDX = \d+;[^\n]*/,
  'const CURRENT_WK_IDX = 0; // week 1 = opening weekend'
);

// --- Inject division filter bar above the tab-bar ---
html = html.replace(
  /<div class="page-wrap">\s*<div class="tab-bar">/,
  `<div class="page-wrap">
  ${MARKER}
  <div class="div-filter" style="display:flex;gap:8px;padding:14px 48px 0;flex-wrap:wrap;background:var(--bg)">
    <button class="div-btn active" data-div="ALL" onclick="setSchedDiv('ALL',this)">All Divisions</button>
    <button class="div-btn" data-div="B" onclick="setSchedDiv('B',this)">B</button>
    <button class="div-btn" data-div="C" onclick="setSchedDiv('C',this)">C</button>
    <button class="div-btn" data-div="CC" onclick="setSchedDiv('CC',this)">CC</button>
    <button class="div-btn" data-div="D" onclick="setSchedDiv('D',this)">D</button>
    <button class="div-btn" data-div="DD" onclick="setSchedDiv('DD',this)">DD</button>
  </div>
  <style>
    .div-btn{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:13px;letter-spacing:.06em;background:var(--card);border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:7px 16px;cursor:pointer;transition:all .15s;white-space:nowrap}
    .div-btn:hover{border-color:var(--gold);color:var(--white)}
    .div-btn.active{background:var(--gold);color:#fff;border-color:var(--gold)}
  </style>
  <div class="tab-bar">`
);

// --- Add JS for setSchedDiv + division filter in render ---
// We hook into the existing \`render()\` function by wrapping \`gameBlock\` calls:
// simplest approach is to add a global SCHED_DIV_FILTER and filter weeks[i].games at render time.
// Inject the state + hook near the top of the <script> block.
html = html.replace(
  /let weekOffset = 0;/,
  `let weekOffset = 0;
let SCHED_DIV_FILTER = 'ALL';
function setSchedDiv(code, btn){
  SCHED_DIV_FILTER = code;
  document.querySelectorAll('.div-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  render();
}
function gamesForDiv(games){
  return SCHED_DIV_FILTER === 'ALL' ? games : games.filter(g => g.div === SCHED_DIV_FILTER);
}`
);

fs.writeFileSync(FILE, html);
console.log('Patched schedule.html');
console.log(`  TEAMS: ${DATA.teams.length}`);
console.log(`  Week 1 games: ${kcslGames.length}`);
