#!/usr/bin/env node
/**
 * Extracts inline <script> blocks from each HTML file and runs them through
 * Node's parser (via vm.Script constructor, which compiles without executing).
 * Flags any syntax errors so we don't ship a broken page.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

let totalErrors = 0;

for (const file of files) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  // Match only plain <script> blocks (no src attribute, no type=module)
  const re = /<script(?![^>]*\bsrc=)(?![^>]*\btype="module")[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  let idx = 0;
  let fileErrors = 0;
  while ((m = re.exec(html)) !== null) {
    idx++;
    const code = m[1].trim();
    if (!code) continue;
    // Skip JSON-LD or text/template blocks
    if (/^\s*[\{\[]/.test(code) && !/[=;(){}]/.test(code.slice(0, 50))) continue;
    try {
      // Wrap in async IIFE so top-level await (if any) parses; also tolerate return
      new vm.Script(code, { filename: `${file}:script#${idx}` });
    } catch (e) {
      // Only report syntax errors, not reference errors
      if (e instanceof SyntaxError) {
        fileErrors++;
        totalErrors++;
        const lineInfo = e.stack.split('\n').slice(0, 3).join('\n');
        console.log(`❌ ${file} script #${idx}:`);
        console.log(lineInfo);
        console.log('---');
      }
    }
  }
  if (fileErrors === 0) {
    console.log(`✅ ${file}`);
  }
}

console.log(`\n${totalErrors === 0 ? '✅ No syntax errors' : `❌ ${totalErrors} syntax errors`}`);
process.exit(totalErrors > 0 ? 1 : 0);
