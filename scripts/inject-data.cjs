#!/usr/bin/env node
/**
 * Injects KCSL team + schedule data into index.html by replacing the
 * DVSL fallback arrays inside loadFallbackData().
 *
 * Run AFTER parse-kcsl-data.js so data/kcsl-data.json exists.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'kcsl-data.json'), 'utf8'));

let html = fs.readFileSync(INDEX, 'utf8');

function fmtLine(obj, indent='  ') {
  const entries = Object.entries(obj).map(([k,v]) => {
    const key = /^[a-z_$][a-z0-9_$]*$/i.test(k) ? k : JSON.stringify(k);
    return `${key}:${JSON.stringify(v)}`;
  }).join(',');
  return `${indent}{${entries}}`;
}

// Strip leaguelineup-specific fields before injecting
const teams = DATA.teams.map(t => {
  const { leaguelineupTeamId, ...rest } = t;
  return rest;
});

// Games use softball-site's SCHEDULE_PREVIEW schema: {wk,date,day,time,field,addr,away,home,as,hs,done}
// Plus we preserve div + bye.
const games = DATA.games
  .filter(g => !g.bye) // hide BYE placeholder rows from the schedule preview
  .map(g => ({
    wk: g.wk,
    date: g.date,
    day: g.day,
    time: g.time,
    field: g.field,
    addr: g.addr || '',
    away: g.away,
    home: g.home,
    as: g.as,
    hs: g.hs,
    done: g.done,
    div: g.div,
  }));

const teamsBlock = `  TEAMS = [
${teams.map(t => fmtLine(t, '    ')).join(',\n')}
  ];`;

// HIST_TEAMS is legacy for DVSL's old seasons — KCSL has no history, empty array.
const histBlock = `  HIST_TEAMS = [];`;

const schedBlock = `  SCHEDULE_PREVIEW = [
${games.map(g => fmtLine(g, '    ')).join(',\n')}
  ];`;

// The DVSL block spans from `  TEAMS = [` (line ~2804) to the closing `];` of SCHEDULE_PREVIEW (line ~2895)
// Replace using a reliable anchor: find `TEAMS = [` inside loadFallbackData and then the next `SCHEDULE_PREVIEW = [` block's closing bracket.

const startMarker = '  TEAMS = [\n';
const startIdx = html.indexOf(startMarker);
if (startIdx < 0) { console.error('Could not find TEAMS = ['); process.exit(1); }

// Find the end: the closing ']; of SCHEDULE_PREVIEW, right before `  HISTORY = [`
const historyIdx = html.indexOf('  HISTORY = [', startIdx);
if (historyIdx < 0) { console.error('Could not find HISTORY = ['); process.exit(1); }

// The replacement should end with a newline so the next line (HISTORY) stays on its own line
const before = html.slice(0, startIdx);
const after = html.slice(historyIdx);

const replacement = [
  teamsBlock,
  histBlock,
  '  ALL_TEAMS = [...TEAMS, ...HIST_TEAMS];',
  schedBlock,
  '', // trailing newline before HISTORY
].join('\n') + '\n';

html = before + replacement + after;

fs.writeFileSync(INDEX, html);
console.log(`Injected ${teams.length} teams and ${games.length} games into index.html`);
console.log(`New file size: ${html.length} bytes`);
