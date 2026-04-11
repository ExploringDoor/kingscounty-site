#!/usr/bin/env node
/**
 * Signs in as admin@kcsl.local then pushes the full KCSL dataset
 * (5 divisions, 41 teams, 19 games) into Firestore.
 *
 *   node scripts/seed-firebase.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const firebaseConfig = {
  apiKey: 'AIzaSyBf7_qvDDBF9Ey3oM_TlRp_XpPgeaYOJ64',
  authDomain: 'kcsl-softball.firebaseapp.com',
  projectId: 'kcsl-softball',
  storageBucket: 'kcsl-softball.firebasestorage.app',
  messagingSenderId: '544013787699',
  appId: '1:544013787699:web:481da4e82b59ede47cb946',
};

const ADMIN_EMAIL = 'admin@kcsl.local';
const ADMIN_PASS  = process.env.KCSL_ADMIN_PASS || 'kcsl12';

const data = JSON.parse(readFileSync(join(ROOT, 'data', 'kcsl-data.json'), 'utf8'));

async function main() {
  console.log(`▶ Initializing Firebase (project: ${firebaseConfig.projectId})`);
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);
  const auth = getAuth(app);

  console.log(`▶ Signing in as ${ADMIN_EMAIL}...`);
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);
    console.log(`✓ Signed in`);
  } catch (e) {
    console.error(`✗ Sign-in failed: ${e.code || e.message}`);
    console.error('  Make sure the user exists in Firebase Console → Authentication → Users.');
    console.error('  If the password is different from "kcsl12", set KCSL_ADMIN_PASS env var.');
    process.exit(1);
  }

  // Check existing data
  console.log('▶ Checking current Firestore state...');
  const existing = await getDocs(collection(db, 'teams'));
  if (existing.size > 0) {
    console.log(`  Firestore already has ${existing.size} teams. Re-seeding will overwrite them.`);
  }

  // Seed divisions
  console.log('▶ Seeding divisions...');
  for (const d of data.divisions) {
    await setDoc(doc(db, 'divisions', d.code), {
      code: d.code,
      label: d.label,
      name: d.label,
      leagueLineupId: d.id || '',
    });
  }
  console.log(`✓ ${data.divisions.length} divisions`);

  // Seed teams
  console.log('▶ Seeding teams...');
  let teamN = 0;
  for (const t of data.teams) {
    const { leaguelineupTeamId, ...teamData } = t;
    await setDoc(doc(db, 'teams', t.id), {
      ...teamData,
      active: t.active !== false,
      updated_at: new Date().toISOString(),
    });
    teamN++;
    if (teamN % 10 === 0) console.log(`  … ${teamN}/${data.teams.length}`);
  }
  console.log(`✓ ${teamN} teams`);

  // Seed games
  console.log('▶ Seeding games...');
  let gameN = 0;
  const realGames = data.games.filter(g => !g.bye);
  for (let i = 0; i < realGames.length; i++) {
    const g = realGames[i];
    const id = `kcsl-g${String(i + 1).padStart(3, '0')}`;
    await setDoc(doc(db, 'games', id), {
      wk: g.wk || 1,
      date: g.date,
      rawDate: g.rawDate || '',
      day: g.day,
      time: g.time,
      field: g.field || '',
      addr: g.addr || '',
      away: g.awayId || (g.away || '').toLowerCase(),
      home: g.homeId || (g.home || '').toLowerCase(),
      div: g.div,
      away_score: null,
      home_score: null,
      done: false,
      status: g.status || 'TBP',
      created_at: new Date().toISOString(),
    });
    gameN++;
  }
  console.log(`✓ ${gameN} games`);

  console.log('\n🎉 Seed complete!');
  console.log(`   Project: ${firebaseConfig.projectId}`);
  console.log(`   ${data.divisions.length} divisions, ${teamN} teams, ${gameN} games`);
  console.log('\n→ Next: reload http://localhost:8181/ and admin.html — everything is now live from Firebase.');

  process.exit(0);
}

main().catch(e => {
  console.error('Seed failed:', e);
  process.exit(1);
});
