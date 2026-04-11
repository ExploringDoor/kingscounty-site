#!/usr/bin/env node
/**
 * One-shot updater that points every HTML/JS file at the real KCSL
 * Firebase project. Replaces the placeholder config with the real
 * values and flips USE_FIREBASE to true in index.html.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const NEW_CONFIG = {
  apiKey: 'AIzaSyBf7_qvDDBF9Ey3oM_TlRp_XpPgeaYOJ64',
  authDomain: 'kcsl-softball.firebaseapp.com',
  projectId: 'kcsl-softball',
  storageBucket: 'kcsl-softball.firebasestorage.app',
  messagingSenderId: '544013787699',
  appId: '1:544013787699:web:481da4e82b59ede47cb946',
};

// Replacements to run over every file
const STRING_REPLACEMENTS = [
  // Old project IDs (from DVSL fork and our placeholder KCSL config)
  [/dvsl-292dd\.firebaseapp\.com/g, `${NEW_CONFIG.projectId}.firebaseapp.com`],
  [/kcsl-292dd\.firebaseapp\.com/g, `${NEW_CONFIG.projectId}.firebaseapp.com`],
  [/"dvsl-292dd"/g,                 `"${NEW_CONFIG.projectId}"`],
  [/"kcsl-292dd"/g,                 `"${NEW_CONFIG.projectId}"`],
  [/dvsl-292dd\.firebasestorage\.app/g, `${NEW_CONFIG.projectId}.firebasestorage.app`],
  [/kcsl-292dd\.firebasestorage\.app/g, `${NEW_CONFIG.projectId}.firebasestorage.app`],
  // Old apiKey / messagingSenderId / appId placeholders
  [/"AIzaSyDXuC-R0aPEX4F7lN5AKq48UC3r5whYzdg"/g, `"${NEW_CONFIG.apiKey}"`],
  [/"145862305559"/g,                             `"${NEW_CONFIG.messagingSenderId}"`],
  [/"449941803190"/g,                             `"${NEW_CONFIG.messagingSenderId}"`],
  [/"1:145862305559:web:[^"]+"/g,                 `"${NEW_CONFIG.appId}"`],
  [/"1:449941803190:web:[^"]+"/g,                 `"${NEW_CONFIG.appId}"`],
];

const files = [
  'index.html', 'admin.html', 'notifications.html', 'rules.html', 'photos.html',
  'registration.html', 'player.html', 'playoffs.html', 'scorer.html',
  'captain.html', 'live-score.html', 'leaders.html',
  'firebase-messaging-sw.js', 'api/update-firebase.js', 'api/update-player.js',
];

let totalSwaps = 0;

for (const file of files) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠ ${file} (missing, skipping)`);
    continue;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  let fileSwaps = 0;
  for (const [regex, replacement] of STRING_REPLACEMENTS) {
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, replacement);
      fileSwaps += matches.length;
    }
  }
  if (fileSwaps > 0) {
    fs.writeFileSync(fullPath, content);
    console.log(`  ✓ ${file}: ${fileSwaps} replacements`);
    totalSwaps += fileSwaps;
  } else {
    console.log(`  - ${file}: no changes`);
  }
}

// Flip USE_FIREBASE in index.html
const indexPath = path.join(ROOT, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
const before = indexContent;
indexContent = indexContent.replace(
  /const USE_FIREBASE = false;/,
  'const USE_FIREBASE = true;'
);
if (indexContent !== before) {
  fs.writeFileSync(indexPath, indexContent);
  console.log('  ✓ index.html: USE_FIREBASE flipped to true');
} else {
  console.log('  - index.html: USE_FIREBASE already true or not found');
}

console.log(`\nTotal replacements: ${totalSwaps}`);
console.log(`Firebase project wired up: ${NEW_CONFIG.projectId}`);
