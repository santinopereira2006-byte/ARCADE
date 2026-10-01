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

Requires Windows PowerShell and a modern browser. There are no package installs or build step.

From this directory, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-arcade.ps1
```

The script starts a local HTTP server at `http://localhost:8080/` and opens the app in your browser. Serve the files over HTTP rather than opening `index.html` directly, because the app uses JavaScript modules.

To check that the expected application files and content are present:

```powershell
powershell -ExecutionPolicy Bypass -File .\verify-arcade.ps1
```

This is a file and content integrity check, not a browser automation or gameplay test.

## Publish

The project is a static site and includes `vercel.json` for Vercel hosting. Import this directory as a project or deploy it with the Vercel CLI; no build command or environment variables are currently required. Other static web hosts can serve the project root as-is. Keep the folders and paths intact, including `assets/`, `css/`, `js/`, and `models/`, because the app loads these files by relative URL.

Google Fonts are requested from `fonts.googleapis.com` and `fonts.gstatic.com`; if those services are unavailable, the browser uses fallback fonts. All game logic and content are local to this project.

## Access and organizer workflow

### Participants

1. An organizer opens **Admin Login** and creates a team in the organizer console.
2. The organizer shares the team name and generated access code with that team.
3. The participant enters both on the check-in screen to start playing.

The participant session is held in the current browser tab session. Team name and access code must match a team in that browser's saved roster.

### Organizers

- Use **Admin Login** on the home screen, or press `Ctrl + Shift + O` to open the organizer access flow.
- The current passphrase is `CSI2026`. It is defined by `ADMIN_PASSPHRASE` in `js/auth.js`; change it there before an event if needed.
- The organizer console can create and remove teams, issue codes, view the roster and scores, jump to a round, skip or reset a question, adjust scores, inspect answer keys, and open the tie-breaker.
- Admins can open the leaderboard and export its data as CSV. The leaderboard reset action restores the built-in sample entries.
- Press `P` to toggle presentation mode. Press `Escape` to close open modals.

### Important storage and access limits

This version has **no backend, server-side authentication, or shared database**. Teams, access codes, scores, and leaderboard entries are saved in the browser's `localStorage`; sign-in state is saved in `sessionStorage`. Browser storage is separated by browser profile and site origin. Consequently, creating teams on one device does not provision them on another device, and standings do not sync between participants or browsers. For an event using multiple devices, this build requires a shared organizer device/browser workflow; it does not provide centralized live standings.

The passphrase and all app code are delivered to the browser. The passphrase is visible in the source, and browser-side role checks are not a security boundary. Do not use this build to protect sensitive data or as production-grade authentication. The access code screen is a local event workflow, not server-enforced access control.

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
