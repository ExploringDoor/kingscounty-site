#!/usr/bin/env node
/**
 * Enter game scores into Firebase. Reads a JSON array of score objects,
 * creates game docs (if they don't exist) and marks them as final,
 * then recalculates team standings (W/L/RS/RA/PCT).
 *
 * Usage:
 *   node scripts/enter-scores.mjs /tmp/kcsl-scores-apr12.json
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'node:fs';

const firebaseConfig = {
  apiKey: 'AIzaSyBf7_qvDDBF9Ey3oM_TlRp_XpPgeaYOJ64',
  authDomain: 'kcsl-softball.firebaseapp.com',
  projectId: 'kcsl-softball',
  storageBucket: 'kcsl-softball.firebasestorage.app',
  messagingSenderId: '544013787699',
  appId: '1:544013787699:web:481da4e82b59ede47cb946',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL = 'admin@kcsl.local';
const ADMIN_PASS = process.env.KCSL_ADMIN_PASS || 'kcsl12';

const scoresFile = process.argv[2];
if (!scoresFile) { console.error('Usage: node scripts/enter-scores.mjs <scores.json>'); process.exit(1); }
const scores = JSON.parse(readFileSync(scoresFile, 'utf8'));

async function main() {
  console.log(`▶ Signing in as ${ADMIN_EMAIL}...`);
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);
  console.log('✓ Signed in');

  // Load current games + teams
  console.log('▶ Loading current data...');
  const [gSnap, tSnap] = await Promise.all([
    getDocs(collection(db, 'games')),
    getDocs(collection(db, 'teams')),
  ]);
  const existingGames = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const teams = {};
  tSnap.docs.forEach(d => { teams[d.id] = { id: d.id, ...d.data() }; });

  // Find the next available game doc ID
  let nextIdx = existingGames.length + 1;

  console.log(`▶ Processing ${scores.length} scores...`);
  for (const s of scores) {
    // Try to find an existing game doc that matches (away, home, time, not done)
    let existing = existingGames.find(g =>
      g.away === s.away && g.home === s.home && !g.done && g.time === s.time
    );

    if (existing) {
      // Update existing game with score
      console.log(`  Updating ${existing.id}: ${s.away} ${s.as} - ${s.home} ${s.hs}`);
      await updateDoc(doc(db, 'games', existing.id), {
        away_score: s.as,
        home_score: s.hs,
        done: true,
        status: 'F',
      });
      existing.done = true;
      existing.away_score = s.as;
      existing.home_score = s.hs;
    } else {
      // Create new game doc (doubleheader game 2, etc.)
      const id = `kcsl-g${String(nextIdx++).padStart(3, '0')}`;
      console.log(`  Creating ${id}: ${s.away} ${s.as} @ ${s.home} ${s.hs} (${s.time})`);
      await setDoc(doc(db, 'games', id), {
        wk: 1,
        date: 'Apr 12',
        rawDate: '4/12/2026',
        day: 'Sun',
        time: s.time,
        field: s.field || '',
        addr: '',
        away: s.away,
        home: s.home,
        div: s.div || '',
        away_score: s.as,
        home_score: s.hs,
        done: true,
        status: 'F',
        created_at: new Date().toISOString(),
      });
    }
  }

  // Recalculate standings for all teams
  console.log('▶ Recalculating standings...');
  // Re-fetch all games now that scores are in
  const allGamesSnap = await getDocs(collection(db, 'games'));
  const allGames = allGamesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.done);

  // Build W/L/RS/RA per team
  const stats = {};
  for (const tid of Object.keys(teams)) {
    stats[tid] = { w: 0, l: 0, ti: 0, rs: 0, ra: 0 };
  }

  for (const g of allGames) {
    const as = g.away_score ?? 0;
    const hs = g.home_score ?? 0;
    if (!stats[g.away]) stats[g.away] = { w: 0, l: 0, ti: 0, rs: 0, ra: 0 };
    if (!stats[g.home]) stats[g.home] = { w: 0, l: 0, ti: 0, rs: 0, ra: 0 };

    stats[g.away].rs += as;
    stats[g.away].ra += hs;
    stats[g.home].rs += hs;
    stats[g.home].ra += as;

    if (as > hs) {
      stats[g.away].w++;
      stats[g.home].l++;
    } else if (hs > as) {
      stats[g.home].w++;
      stats[g.away].l++;
    } else {
      stats[g.away].ti++;
      stats[g.home].ti++;
    }
  }

  // Write updated standings to Firebase
  for (const [tid, s] of Object.entries(stats)) {
    if (!teams[tid]) continue;
    const gp = s.w + s.l + s.ti;
    const pct = gp > 0 ? s.w / gp : 0;
    const streak = s.w > 0 ? `Won ${s.w}` : s.l > 0 ? `Lost ${s.l}` : '—';
    await updateDoc(doc(db, 'teams', tid), {
      w: s.w,
      l: s.l,
      ti: s.ti,
      rs: s.rs,
      ra: s.ra,
      pct: parseFloat(pct.toFixed(3)),
      streak,
      updated_at: new Date().toISOString(),
    });
  }

  // Print standings summary for C Division
  console.log('\n📊 C DIVISION STANDINGS AFTER WEEK 1:');
  console.log('─'.repeat(50));
  const cTeams = Object.entries(stats)
    .filter(([tid]) => teams[tid]?.div === 'C')
    .map(([tid, s]) => ({ name: teams[tid]?.name || tid, ...s, pct: (s.w + s.l + s.ti) > 0 ? s.w / (s.w + s.l + s.ti) : 0 }))
    .sort((a, b) => b.pct - a.pct || b.w - a.w || (b.rs - b.ra) - (a.rs - a.ra));

  for (const t of cTeams) {
    const diff = t.rs - t.ra;
    console.log(`  ${t.name.padEnd(20)} ${t.w}-${t.l}  RS:${String(t.rs).padStart(3)}  RA:${String(t.ra).padStart(3)}  DIFF:${diff >= 0 ? '+' : ''}${diff}`);
  }

  console.log('\n🎉 Done! Scores entered + standings updated.');
  console.log('→ Reload the KCSL site to see the results.');
  process.exit(0);
}

main().catch(e => { console.error('Failed:', e); process.exit(1); });
