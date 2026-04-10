# KCSL Softball — League Website

Official website for the **Kings County Softball League (KCSL)**, a 40+ team softball league in Brooklyn, NY. Modeled after the DVSL softball site.

Commissioner: Michael DiBlasio — (917) 744-2159

## Structure

- **41 teams across 5 divisions:** B, C, CC, D, DD
- **Season:** Spring 2026, opens Sunday April 12, 2026
- **Games:** Sunday mornings at Marine Park, Bay 8th, Bergen Beach, Dyker, and other South Brooklyn fields

## Pages

| File | Description |
|------|-------------|
| `index.html` | Main SPA — Home, Standings (by division), Leaderboard, Teams, Recaps |
| `schedule.html` | Full season schedule with division filter and week navigation |
| `playoffs.html` | Playoff bracket + champions gallery |
| `rules.html` | KCSL rulebook (TODO: replace DVSL rules text) |
| `photos.html` | Photo gallery |
| `admin.html` | Admin dashboard — game management, team editor, box score entry |
| `captain.html` | Team captain interface |
| `scorer.html` | Live scoring during games |

## Assets

| File | Description |
|------|-------------|
| `kcsl-logo.svg` | Placeholder league logo — **REPLACE with real logo when received** |
| `logos/<team-id>.svg` | 41 placeholder team logos (colored circles with initials) |

## Setup

No build step required. Pure HTML / CSS / JS — serve any HTML file from a static host.

### Local dev

```bash
cd ~/Desktop/kingscounty-site
python3 -m http.server 8080
# open http://localhost:8080/index.html
```

### Deploy

Recommended: **Vercel** (the admin panel needs serverless functions for box-score parsing).

```bash
vercel --prod
```

GitHub Pages works too if you don't need the admin panel's Claude AI parsing.

## Scripts

All scraping / data / patch scripts live in `scripts/`:

| Script | Purpose |
|--------|---------|
| `parse-kcsl-data.js` | Parses pre-fetched LeagueLineup HTML (from `/tmp/kcsl/`) into `data/kcsl-data.json` and `data/kcsl-hardcoded.js` |
| `inject-data.js` | Injects TEAMS + SCHEDULE_PREVIEW arrays into `index.html` fallback data |
| `rebrand.js` | Global DVSL → KCSL text replacements across all HTML files |
| `add-division-standings.js` | Patches standings page to use 5 division-grouped tables |
| `patch-schedule-page.js` | Rewrites schedule.html data + adds division filter |
| `generate-logos.js` | Generates 41 placeholder SVG team logos in `logos/` |

To re-scrape LeagueLineup:

```bash
# 1. Fetch standings HTML for each division
mkdir -p /tmp/kcsl && cd /tmp/kcsl
for id in 1057282 1057283 1045018 1057284 1057281; do
  curl -sL "https://www.leaguelineup.com/standings_baseball.asp?url=kingscountysoftball&divisionid=$id" \
    -o "standings-$id.html" && sleep 1
done

# 2. Fetch full-season schedule across all divisions
curl -sL -c cookies.txt \
  "https://www.leaguelineup.com/schedulesearch.asp?url=kingscountysoftball" -o search1.html
SID=$(grep -o 'sid=[0-9]*' search1.html | head -1 | cut -d= -f2)
curl -sL -b cookies.txt -X POST \
  "https://www.leaguelineup.com/schedulesearch.asp?sid=$SID&url=kingscountysoftball&sr=0" \
  --data "StartMM=04&StartDD=01&StartYY=2026&EndMM=10&EndDD=31&EndYY=2026&divisionid=0&LocationID=0&sr=0&Submit=Search" \
  -o all-games.html

# 3. Parse + regenerate data files
cd ~/Desktop/kingscounty-site
node scripts/parse-kcsl-data.js
```

## Data Source

All team, division, and schedule data is scraped from:
<https://www.leaguelineup.com/welcome.asp?url=kingscountysoftball>

Re-run the scraper + `parse-kcsl-data.js` whenever the upstream publishes more of the Spring 2026 schedule (currently only opening weekend is published).

## Design System

- **Fonts:** Barlow Condensed (headers), Barlow (body), Inter (UI), Oswald (scores)
- **Colors:** Red (`#E63946`) · White (`#F8F9FA`) · Blue (`#1D4ED8`) · Dark bg (`#0A0E1A`)
- **Theme:** Dark, sports-editorial aesthetic with logo watermarks

## TODO (post-launch)

- [ ] Replace `kcsl-logo.svg` placeholder with real KCSL logo (commissioner to provide)
- [ ] Replace `logos/*.svg` placeholders with real team logos as they're submitted
- [ ] Set up new Firebase project (`kcsl-softball`) and wire up admin panel
- [ ] Full Spring 2026 schedule once LeagueLineup publishes it
- [ ] KCSL-specific rules in `rules.html` (currently still DVSL rules)
- [ ] Clean up stale secondary pages (photos, stats, leaders) that still reference DVSL demo content
- [ ] Deploy to production host (Vercel recommended for admin panel)
