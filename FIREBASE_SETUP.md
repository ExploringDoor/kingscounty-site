# KCSL Firebase Setup

The KCSL site currently runs on **hardcoded fallback data** from `data/kcsl-data.json`. Admin edits do not persist because there's no database yet. This guide walks through setting up a real Firebase project so the admin panel can save games, scores, rosters, etc.

**Timeline:** You said by end of Spring 2026 season (~September 2026) so the commissioner can self-edit. Everything below can be done in 20-30 minutes.

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com/> and click **Add project**
2. Name: `kcsl-softball` (or whatever — remember the project ID)
3. Skip Google Analytics (you can add it later)
4. Once the project is created, click **Build → Firestore Database → Create database**
   - Choose **Start in production mode**
   - Region: `us-east4` or `us-east1` (closest to Brooklyn)
5. Click **Build → Authentication → Get started → Email/Password → Enable → Save**
6. Go to **Authentication → Users → Add user** and create at least one admin account with your email + a strong password. This is how you'll log into `admin.html`.

## 2. Grab the config

1. Project Overview → gear icon → **Project settings → General**
2. Scroll to **Your apps**, click the **`</>`** (web) icon to add a web app
3. App nickname: "KCSL Site"
4. Click **Register app** — Firebase will show you a `firebaseConfig` object like:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "kcsl-softball.firebaseapp.com",
     projectId: "kcsl-softball",
     storageBucket: "kcsl-softball.firebasestorage.app",
     messagingSenderId: "123...",
     appId: "1:123:web:abc..."
   };
   ```
5. Copy those 6 values — you'll paste them into the seed tool next.

## 3. Set Firestore security rules

In the Firebase console → **Firestore Database → Rules**, replace the default with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Click **Publish**. This lets:
- Anyone read teams/games/standings (so the public site works)
- Only authenticated users (admins) write

## 4. Seed the data

Open `firebase-seed.html` in your browser (from the local server or a deploy):

```bash
cd ~/Desktop/kingscounty-site
python3 -m http.server 8181
# then open http://localhost:8181/firebase-seed.html
```

1. Paste the 6 `firebaseConfig` values into the form
2. Click **🌱 Seed Firebase Now**
3. Watch the log — it'll seed 5 divisions, 41 teams, and 19 games
4. When done, click **📝 Print config** and copy the printed `FIREBASE_CONFIG` block

## 5. Wire the site up to Firebase

Paste the printed `FIREBASE_CONFIG` block into these files, replacing the existing dummy one:

- `index.html` (search for `FIREBASE_CONFIG = {`)
- `admin.html` (same search)
- `schedule.html`
- `playoffs.html`
- `notifications.html`

In **`index.html`** there's one extra step: find this block (around line 2495):
```js
const USE_FIREBASE = false;
```
Change it to:
```js
const USE_FIREBASE = true;
```

That flips the home page from the hardcoded fallback to live Firebase reads.

## 6. Test the admin

1. Open `admin.html` in your browser
2. Log in with the email/password you created in step 1
3. You should see:
   - 41 teams in the dropdowns
   - 19 games in the schedule
   - All 5 divisions (B / C / CC / D / DD) in the standings
4. Try editing a game — the change should persist across page reloads

## Future: re-scraping

As LeagueLineup publishes more of the Spring 2026 schedule, re-run the scraper and re-seed. The seed tool will ask for confirmation before overwriting existing data.

```bash
# 1. Re-fetch from LeagueLineup (see README for the curl commands)
# 2. Regenerate the local data file
node scripts/parse-kcsl-data.js
# 3. Open firebase-seed.html, fill in config, click Seed (it'll overwrite cleanly)
```

## What's in Firestore

After seeding, the following collections exist:

- **`divisions`** — 5 docs: `B`, `C`, `CC`, `D`, `DD`
- **`teams`** — 41 docs keyed by team id: `heat`, `carnage`, `padres`, etc. Each has `{name, short, div, color, w, l, rs, ra, ...}`
- **`games`** — 19 docs keyed by `kcsl-g001` through `kcsl-g019`. Each has `{wk, date, day, time, field, away, home, div, away_score, home_score, done}`
- **`players`** — empty (KCSL doesn't track player stats yet; admin can add them later)
- **`recaps`** — empty (admin can add game recaps as the season plays out)

## Troubleshooting

**"Permission denied" when the admin tries to write:**
Your Firestore rules aren't published yet. Re-do step 3.

**Admin login fails with "auth/configuration-not-found":**
Email/Password sign-in isn't enabled. Go to Authentication → Sign-in method → Email/Password → Enable.

**Admin shows "Using local KCSL data — Firebase not yet configured":**
Either the `FIREBASE_CONFIG` in admin.html is still the dummy one, or Firebase returned an error. Check the browser console (F12) for details.

**Home page still shows hardcoded data after seeding:**
You forgot to flip `USE_FIREBASE = true` in `index.html`. Search for `USE_FIREBASE` and change `false` to `true`.
