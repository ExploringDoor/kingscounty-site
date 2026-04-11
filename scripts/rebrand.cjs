#!/usr/bin/env node
/**
 * Global text rebrand: DVSL → KCSL, Delaware Valley → Kings County, etc.
 * Applies to all .html files in the project root (not scripts/, data/, logos/, api/).
 *
 * Safe to re-run — idempotent except for case-sensitivity.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Order matters — do longer/more-specific phrases first so we don't partially
// rewrite them with the shorter ones.
const REPLACEMENTS = [
  // Full league name
  [/Delaware Valley Synagogue League/g, 'Kings County Softball League'],
  [/Delaware Valley Softball League/g,  'Kings County Softball League'],
  [/Delaware Valley\b/g,                'Kings County'],

  // Location references
  [/Philadelphia area/g,                'Brooklyn, NY'],
  [/Bucks, Montgomery, and Philadelphia Counties, PA/g, 'Brooklyn, NY'],
  [/Philadelphia, PA/g,                 'Brooklyn, NY'],
  [/Ambler PA/g,                        'Brooklyn NY'],
  [/Elkins Park PA/g,                   'Brooklyn NY'],
  [/Jenkintown PA/g,                    'Brooklyn NY'],

  // Brand tokens — case-sensitive
  [/DVSL Commissioner/g,                'KCSL Commissioner'],
  [/DVSLCommissioner@gmail\.com/g,      'kcslcommissioner@gmail.com'],
  [/\bDVSL\b/g,                         'KCSL'],
  [/\bdvsl\b/g,                         'kcsl'],

  // Logo / image filenames — DVSL has dvsl-logo-dark.png etc. which we deleted,
  // so replace references with a placeholder that won't 404 (or blank src).
  [/dvsl-logo-dark\.png/g,              'kcsl-logo.png'],
  [/dvsl-logo-glass\.png/g,             'kcsl-logo.png'],
  [/dvsl-hero2?\.png/g,                 'kcsl-hero.jpg'],
  [/ki-silver-cup-2025\.png/g,          'kcsl-champions-placeholder.png'],
  [/champ-photo\.png/g,                 'kcsl-champions-placeholder.png'],

  // Season dates — DVSL 2026 ran Apr 18-Sep 11. KCSL opens Apr 12.
  // Keep the year but soften specific Philadelphia dates if they appear in prose.
  [/Apr 18 . Sep 11/g,                  'Apr 12 – Sep 2026'],
  [/Apr 18 – Sep 11/g,                  'Apr 12 – Sep 2026'],
];

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let totalSwaps = 0;

for (const file of files) {
  const p = path.join(ROOT, file);
  const before = fs.readFileSync(p, 'utf8');
  let after = before;
  let fileSwaps = 0;
  for (const [re, to] of REPLACEMENTS) {
    const count = (after.match(re) || []).length;
    if (count > 0) {
      after = after.replace(re, to);
      fileSwaps += count;
    }
  }
  if (fileSwaps > 0) {
    fs.writeFileSync(p, after);
    console.log(`${file}: ${fileSwaps} replacements`);
    totalSwaps += fileSwaps;
  } else {
    console.log(`${file}: no changes`);
  }
}

console.log(`\nTotal: ${totalSwaps} replacements across ${files.length} files`);
