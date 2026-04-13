#!/usr/bin/env node
/**
 * Add games to Firebase from a JSON file. Unlike enter-scores.mjs,
 * this creates game docs WITHOUT marking them as done (for future weeks).
 *
 * Usage: node scripts/add-games.mjs /tmp/kcsl-week2.json
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'node:fs';

const app = initializeApp({
  apiKey: 'AIzaSyBf7_qvDDBF9Ey3oM_TlRp_XpPgeaYOJ64',
  authDomain: 'kcsl-softball.firebaseapp.com',
  projectId: 'kcsl-softball',
  storageBucket: 'kcsl-softball.firebasestorage.app',
  messagingSenderId: '544013787699',
  appId: '1:544013787699:web:481da4e82b59ede47cb946',
});
const db = getFirestore(app);
const auth = getAuth(app);

await signInWithEmailAndPassword(auth, 'admin@kcsl.local', process.env.KCSL_ADMIN_PASS || 'kcsl12');
console.log('Signed in');

const games = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const existing = await getDocs(collection(db, 'games'));
let nextIdx = existing.size + 1;

for (const g of games) {
  const id = `kcsl-g${String(nextIdx++).padStart(3, '0')}`;
  await setDoc(doc(db, 'games', id), {
    wk: g.wk || 2,
    date: g.date || 'Apr 19',
    rawDate: g.rawDate || '4/19/2026',
    day: g.day || 'Sun',
    time: g.time || 'TBD',
    field: g.field || 'TBD',
    addr: '',
    away: g.away,
    home: g.home,
    div: g.div || '',
    away_score: null,
    home_score: null,
    done: false,
    status: 'TBP',
    created_at: new Date().toISOString(),
  });
  console.log(`  ${id}: ${g.away} @ ${g.home} (${g.div})`);
}
console.log(`\nAdded ${games.length} Week 2 games. Total games: ${existing.size + games.length}`);
process.exit(0);
