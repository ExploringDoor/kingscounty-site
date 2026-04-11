#!/usr/bin/env node
/**
 * Simulates what the browser does on page load:
 *   1. Extracts loadFallbackData() from index.html
 *   2. Runs it in a sandbox
 *   3. Then runs the build* functions that populate containers
 *   4. Reports which ones succeeded and which threw errors
 *
 * This catches runtime errors (undefined refs, missing DOM elements) that
 * static syntax checks miss.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Extract all <script> bodies (no src attribute) and concatenate
const scripts = [];
const re = /<script(?![^>]*\bsrc=)(?![^>]*\btype="module")[^>]*>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) scripts.push(m[1]);

// Build a minimal DOM stub: document.getElementById returns a fake element
// that records innerHTML assignments. document.querySelectorAll returns [].
const elements = {};
const fakeCtx = new Proxy({}, { get: () => () => {} });
function fakeEl(id) {
  if (elements[id]) return elements[id];
  const el = {
    id,
    innerHTML: '',
    textContent: '',
    style: {},
    classList: { add(){}, remove(){}, toggle(){}, contains:()=>false },
    addEventListener(){},
    removeEventListener(){},
    querySelectorAll: () => [],
    querySelector: () => null,
    appendChild(){},
    removeChild(){},
    get parentNode(){ return null; },
    get children(){ return []; },
    // Canvas-like
    getContext: () => fakeCtx,
    width: 1280,
    height: 800,
    offsetWidth: 1280,
    offsetHeight: 800,
  };
  elements[id] = el;
  return el;
}

const fakeDocument = {
  getElementById: (id) => fakeEl(id),
  querySelector: (sel) => fakeEl('q:' + sel),
  querySelectorAll: () => [],
  createElement: () => fakeEl('__new__'),
  body: { classList: { add(){}, remove(){}, toggle(){}, contains:()=>false }, style:{}, appendChild(){}, addEventListener(){} },
  addEventListener(){},
  removeEventListener(){},
  title: '',
};
const fakeWindow = {
  addEventListener(){},
  removeEventListener(){},
  location: { hash: '', href: '' },
  sessionStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout: (fn, ms) => {},
  setInterval: () => 0,
  clearInterval: () => {},
  clearTimeout: () => {},
  innerWidth: 1280,
  innerHeight: 800,
  navigator: { userAgent: '', share: undefined, clipboard: { writeText: () => Promise.resolve() } },
  matchMedia: () => ({ matches: false, addListener(){}, removeListener(){} }),
  IntersectionObserver: function(){ return { observe(){}, disconnect(){}, unobserve(){} }; },
  ResizeObserver: function(){ return { observe(){}, disconnect(){}, unobserve(){} }; },
  MutationObserver: function(){ return { observe(){}, disconnect(){}, takeRecords(){return[];} }; },
  fetch: () => Promise.reject(new Error('fetch stub')),
  IntersectionObserverEntry: function(){},
};
fakeWindow.window = fakeWindow;
fakeWindow.document = fakeDocument;

const sandbox = {
  document: fakeDocument,
  window: fakeWindow,
  location: fakeWindow.location,
  sessionStorage: fakeWindow.sessionStorage,
  localStorage: fakeWindow.localStorage,
  navigator: fakeWindow.navigator,
  setTimeout: fakeWindow.setTimeout,
  setInterval: fakeWindow.setInterval,
  clearInterval: fakeWindow.clearInterval,
  clearTimeout: fakeWindow.clearTimeout,
  requestAnimationFrame: fakeWindow.requestAnimationFrame,
  cancelAnimationFrame: fakeWindow.cancelAnimationFrame,
  IntersectionObserver: fakeWindow.IntersectionObserver,
  ResizeObserver: fakeWindow.ResizeObserver,
  MutationObserver: fakeWindow.MutationObserver,
  fetch: fakeWindow.fetch,
  console,
  Promise,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Set,
  Map,
  RegExp,
  Error,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  URL,
  TextEncoder,
  TextDecoder,
};
vm.createContext(sandbox);

// Concatenate all big scripts into one blob so that top-level const/let from
// one script are visible to another (browsers share the top-level lexical
// scope across classic <script> tags).
const mainScripts = scripts.filter(s => s.length > 10000);
if (mainScripts.length === 0) { console.error('Could not find main scripts'); process.exit(1); }

const blob = mainScripts.join('\n;\n')
  .replace(/await import\([^)]+\)/g, '({})')
  .replace(/await getDb\(\)/g, 'null');

try {
  vm.runInContext(blob, sandbox, { filename: 'combined.js' });
  console.log(`✓ Combined scripts executed (${blob.length} bytes)`);
} catch (e) {
  console.log(`✗ Combined scripts threw: ${e.message}`);
  console.log((e.stack||'').split('\n').slice(0, 4).join('\n'));
}

// Try calling loadFallbackData and the build functions
const toCall = [
  'loadFallbackData',
  'buildTicker',
  'buildStandings',
  'buildHomeSidebar',
  'buildSchedule',
  'buildTeamsBigCards',
  'buildLeaderboard',
  'buildRecaps',
  'buildHistory',
  'populateTeamsDropdown',
  'initNextGame',
  'buildStand2026',
];

for (const name of toCall) {
  if (typeof sandbox[name] !== 'function') {
    console.log(`  - ${name}: not defined`);
    continue;
  }
  try {
    sandbox[name]();
    console.log(`  ✓ ${name}()`);
  } catch (e) {
    console.log(`  ✗ ${name}() threw: ${e.message}`);
    // Print first stack frame with line number if useful
    const frame = (e.stack || '').split('\n').slice(1,2).join('');
    if (frame) console.log(`      ${frame.trim()}`);
  }
}

// Report what got populated
console.log('\nContent written to DOM elements:');
for (const [id, el] of Object.entries(elements)) {
  const len = (el.innerHTML || '').length;
  if (len > 0) {
    console.log(`  #${id}: ${len} bytes`);
  }
}

// Show a snippet of sched-wrap and home-standings-sidebar
for (const id of ['sched-wrap', 'home-standings-sidebar', 'divStandings']) {
  if (elements[id] && elements[id].innerHTML) {
    console.log(`\n#${id} preview (first 200 chars):`);
    console.log(`  ${elements[id].innerHTML.slice(0, 200)}`);
  }
}
