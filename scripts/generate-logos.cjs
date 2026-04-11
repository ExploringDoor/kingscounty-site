#!/usr/bin/env node
/**
 * Generates SVG placeholder logos for every KCSL team.
 * Output: logos/<team-id>.svg (one per team)
 *
 * Each logo is a colored circle (team.color) with white initials
 * and a thin stroke. Later, replace with real PNG logos as they arrive.
 *
 * softball-site references `logos/<id>.png` — we generate `.svg` and
 * the existing `<img src="logos/..png" onerror>` will fall back, OR
 * we update getLogoId() in index.html to point at `.svg` instead.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGOS = path.join(ROOT, 'logos');
fs.mkdirSync(LOGOS, { recursive: true });

const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'kcsl-data.json'), 'utf8'));

function initials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    // Single word — take first 2-3 chars
    return words[0].slice(0, words[0].length <= 4 ? words[0].length : 3).toUpperCase();
  }
  // Multi-word — take first letters, max 4
  return words.slice(0, 4).map(w => w[0]).join('').toUpperCase();
}

function contrastColor(hex) {
  // Pick white or near-black text based on luminance
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const L = 0.2126*r + 0.7152*g + 0.0722*b; // 0-255
  return L > 160 ? '#0A0E1A' : '#F8F9FA';
}

function buildSvg(team) {
  const text = initials(team.name);
  const textColor = contrastColor(team.color);
  const fontSize = text.length <= 2 ? 72 : text.length === 3 ? 56 : 44;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="g-${team.id}" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="${team.color}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${team.color}" stop-opacity="0.72"/>
    </radialGradient>
  </defs>
  <circle cx="100" cy="100" r="92" fill="url(#g-${team.id})" stroke="#0A0E1A" stroke-width="4"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="${textColor}" stroke-opacity="0.28" stroke-width="2"/>
  <text x="100" y="${100 + fontSize*0.35}" text-anchor="middle"
        font-family="Barlow Condensed, Impact, Arial, sans-serif"
        font-weight="900" font-size="${fontSize}" fill="${textColor}"
        letter-spacing="1.5">${text}</text>
  <text x="100" y="165" text-anchor="middle"
        font-family="Barlow, Arial, sans-serif"
        font-weight="700" font-size="12" fill="${textColor}" fill-opacity="0.72"
        letter-spacing="1">${team.div} DIVISION</text>
</svg>
`;
}

let count = 0;
for (const team of DATA.teams) {
  const svg = buildSvg(team);
  const outPath = path.join(LOGOS, `${team.id}.svg`);
  fs.writeFileSync(outPath, svg);
  count++;
}
console.log(`Generated ${count} placeholder logos in ${LOGOS}`);
