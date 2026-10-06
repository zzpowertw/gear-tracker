# CLAUDE.md

Personal hiking-gear weight calculator PWA. Single user, not published to any store. Owner is not a programmer — explain changes in plain Traditional Chinese.

## Architecture (no build step)
- `index.html` loads React / lucide-react from esm.sh via import map, and Babel standalone transpiles `app.jsx` in the browser. No Node/npm needed; don't introduce a bundler without asking.
- `gear-data.js` — gear list (edit items here). Item `id`s are stored inside saved records; never rename an existing id.
- `storage.js` — local mode (localStorage) when `firebase-config.js` is empty; otherwise Google sign-in + Firestore at `users/{uid}/records/{recordId}` with persistent offline cache. Cloud writes are fire-and-forget (don't await server ack — hangs offline).
- `firestore.rules` — reference copy; must be pasted into Firebase console manually.
- `sw.js` — network-first for own files, cache-first for pinned CDN URLs.
- Hosting: GitHub Pages from `main` branch root → https://zzpowertw.github.io/gear-tracker/

## Release checklist (every change)
1. Bump `APP_VERSION` in `app.jsx` **and** `CACHE_VERSION` in `sw.js` (same value, semver).
2. Add entry to `CHANGELOG.md` (Traditional Chinese).
3. Commit with clear message, tag `vX.Y.Z`, push `main` + tags. Owner wants every change auto-pushed.

## Local preview
`python -m http.server 8765` (also in `.claude/launch.json` as `gear-app`).
