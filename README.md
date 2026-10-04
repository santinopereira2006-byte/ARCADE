# ARCADE

ARCADE is a browser based, five round technical competition game for the CSI Technical Symposium 2026. It includes participant check-in, an organizer console, scoring, results, and a leaderboard.

## What is included

1. **Scale Wars** — character size comparisons and estimation.
2. **CTRL + ALT + GUESS** — identify technology from progressively revealed images.
3. **Tech Meme Battle** — developer meme trivia and a meme creation activity scored by judges.
4. **Blackout Build** — solve JavaScript problems during timed visibility and blackout phases.
5. **Retro Blast** — first-person cyberpunk aim reflex simulator with neon blaster combat, waves, and hazard bombs.

The app also provides a results screen, performance tiers, presentation mode, and a sudden-death estimation tie-breaker. Questions and game content are in `js/data/`; game rendering and logic are in `js/games/`.

## Run locally

### Option 1: Node.js + MongoDB Server (Recommended)

This mode connects all participant laptops, organizer screens, and projector leaderboards to a shared MongoDB database with live sync.

1. Install dependencies (already prepared):
   ```bash
   npm install
   ```
2. Configure your database in `.env`:
   - By default, it connects to local MongoDB: `mongodb://127.0.0.1:27017/arcade_tournament`
   - Or paste your free **MongoDB Atlas** cloud URI:
     ```env
     MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/arcade_tournament?retryWrites=true&w=majority
     PORT=8080
     ADMIN_PASSPHRASE=CSI2026
     ```
3. Start the server:
   ```bash
   npm start
   # or for auto-reload during development:
   npm run dev
   # or on Windows, simply double-click start-arcade.bat
   ```
4. Open `http://localhost:8080` in your browser. Other devices on the same Wi-Fi / network can connect to `http://<YOUR_IP_ADDRESS>:8080`.

### Option 2: Zero-Dependency Fallback Server

If Node.js or MongoDB is unavailable, you can still launch the app with PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-arcade.ps1
```

In fallback mode, data is cached in the browser's `localStorage`. When the MongoDB backend becomes available, the app automatically synchronizes with the database!

To check that all expected application files and content are present:

```powershell
powershell -ExecutionPolicy Bypass -File .\verify-arcade.ps1
```

## Centralized MongoDB Database & Live Sync

The backend provides:
- **Shared Team Roster**: Teams created by an admin are saved to MongoDB and immediately available on all participant devices.
- **Real-Time Live Sync**: Leaderboard updates and team registrations are broadcast live via Server-Sent Events (SSE). Projector displays and organizer terminals update without refreshing.
- **Persistent Leaderboard**: Player scores across all 5 rounds and final rankings are permanently saved.
- **Offline-First Hybrid Resilience**: If the database or network temporarily disconnects, games and scores automatically fall back to local storage and queue sync when reconnected.

## Access and organizer workflow

### Participants

1. An organizer creates a team in the organizer console (or registers on-the-fly).
2. The organizer shares the team name and 6-character access code with that team.
3. The participant enters both on the check-in screen to begin.

### Organizers

- Use **Admin Login** on the home screen, or press `Ctrl + Shift + O` to open the organizer access flow.
- The default passphrase is `CSI2026` (configurable in `.env` as `ADMIN_PASSPHRASE`).
- The organizer console can create and remove teams, issue codes, view the roster and scores, jump to any round, adjust scores, inspect answer keys, and launch the sudden-death tie-breaker.
- Admins can view the live leaderboard and export rankings as CSV.
- Press `P` to toggle presentation mode. Press `Escape` to close open modals.

## Project layout

```text
index.html                 Tournament app entry point and round screens
retro.html                 Retro Blast 3D arcade machine standalone launcher
css/                       Cyberpunk and game mode stylesheets (arcade-style, blackout, retro, etc.)
js/app.js                  App controller and round flow orchestration
js/auth.js                 Browser-side organizer and participant sessions
js/leaderboard.js          Browser-local roster and leaderboard storage
js/organizer.js            Team management and organizer console
js/state.js                Current run and score state
js/timer.js                Round timers
js/ui.js                   Screen and results rendering
js/data/                   Questions, challenges, and tie-breaker data
js/games/                  Rendering and interaction for each round
js/room/                   3D Arcade Arena lobby scene, physics, and decor
js/vendor/                 Vendored Three.js library and loaders
assets/                    Game artwork, silhouettes, and UI badges
models/                    Organized 3D glTF/GLB models for arena and Scale Wars
start-arcade.bat           Windows double-click local server launcher
start-arcade.ps1           Zero-dependency local HTTP server launcher
verify-arcade.ps1          File and content integrity check
vercel.json                Vercel static hosting configuration
```

## Credits

Event leadership and volunteer details are maintained by the event organizers. Character model attribution and usage terms are provided in the relevant model folders' `license.txt` files.
