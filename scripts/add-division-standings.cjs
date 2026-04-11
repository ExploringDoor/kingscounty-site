#!/usr/bin/env node
/**
 * Replaces the DVSL year-tabs + historical standings panels with a KCSL
 * division-grouped standings view. Idempotent: bails if the KCSL marker is
 * already present.
 */
const fs = require('fs');
const path = require('path');

const INDEX = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(INDEX, 'utf8');

const MARKER = '<!-- KCSL DIVISION STANDINGS -->';
if (html.includes(MARKER)) {
  console.log('Already patched — skipping');
  process.exit(0);
}

// Build replacement block
const NEW_BLOCK = `${MARKER}
<!-- DIVISION TABS -->
<div class="year-tabs" id="divTabs">
  <button class="yr-tab active" onclick="showStandDiv('ALL',this)">All Divisions</button>
  <button class="yr-tab" onclick="showStandDiv('B',this)">B</button>
  <button class="yr-tab" onclick="showStandDiv('C',this)">C</button>
  <button class="yr-tab" onclick="showStandDiv('CC',this)">CC</button>
  <button class="yr-tab" onclick="showStandDiv('D',this)">D</button>
  <button class="yr-tab" onclick="showStandDiv('DD',this)">DD</button>
</div>

<div class="main">

<div class="yr-panel show" id="yr-2026">
  <div id="stand-2026-header"></div>
  <div class="legend">
    <span><b>W</b> Wins</span><span><b>L</b> Losses</span><span><b>T</b> Ties</span><span><b>PCT</b> Win %</span><span><b>AVG</b> Runs Avg</span><span><b>GB</b> Games Behind</span><span><b>RF</b> Runs For</span><span><b>RA</b> Runs Against</span><span><b>DIFF</b> Differential</span><span><b>STRK</b> Streak</span>
  </div>
  <!-- Division-grouped standings tables injected here by buildStand2026() -->
  <div id="divStandings"></div>
</div>

`;

// Find the boundaries. Start at "<!-- YEAR TABS -->" line, end just before "</div><!-- /main -->".
const startAnchor = '<!-- YEAR TABS -->';
const endAnchor = '</div><!-- /main -->';

const startIdx = html.indexOf(startAnchor);
if (startIdx < 0) { console.error('startAnchor not found'); process.exit(1); }
const endIdx = html.indexOf(endAnchor);
if (endIdx < 0) { console.error('endAnchor not found'); process.exit(1); }

// Walk back from endIdx past whitespace to preserve layout
let cutEnd = endIdx;
while (cutEnd > 0 && /\s/.test(html[cutEnd - 1])) cutEnd--;
// We want to stop just before the final closing </div> that wraps the last yr-panel
// That close div immediately precedes endAnchor (with whitespace between).
// Our new block closes its own <div class="yr-panel show">, so strip everything
// from startAnchor through the trailing </div> just before endAnchor.

html = html.slice(0, startIdx) + NEW_BLOCK + html.slice(endIdx);

fs.writeFileSync(INDEX, html);
console.log('Replaced standings HTML structure');
console.log('Bytes delta:', html.length - fs.statSync(INDEX).size);
