# CLAUDE.md

Personal hiking-gear weight calculator PWA. Single user, not published to any store. Owner is not a programmer — explain changes in plain Traditional Chinese.

## Architecture (no build step)
- `index.html` loads React / lucide-react from esm.sh via import map, and Babel standalone transpiles `app.jsx` in the browser. No Node/npm needed; don't introduce a bundler without asking.
- `gear-data.js` — preset categories, sample gear (for "載入範例清單"), and `upgradeLegacyRecord` (v1 → v2 record format). Sample ids must never be renamed: v1 records are converted through them.
- `storage.js` — per-user collections `gear`, `records`, `meta` (doc `settings`: customCategories, targetG, lastBackupAt). Not signed in → localStorage; signed in → Firestore `users/{uid}/<collection>` with persistent offline cache. Cloud writes are fire-and-forget (don't await server ack — hangs offline).
- `firestore.rules` — reference copy; must be pasted into Firebase console manually.
- `sw.js` — network-first for own files, cache-first for pinned CDN URLs.
- Hosting: GitHub Pages from `main` branch root → https://zzpowertw.github.io/gear-tracker/

## Data compatibility rules (owner's data must survive every update)
- Records are self-contained snapshots: `{ id, title, date, total, items: [{ id, cat, name, note, weight }] }`. Never make records depend on the live gear list.
- Changing a stored shape → add an upgrade function (like `upgradeLegacyRecord`) that runs on read; never require manual migration.
- Backup files carry `schema`; if the backup shape changes, bump `BACKUP_SCHEMA` in app.jsx and teach `normalizeBackup` to read every older schema.
- Import only upserts, never deletes.

## Release checklist (every change)
1. Bump `APP_VERSION` in `app.jsx` **and** `CACHE_VERSION` in `sw.js` (same value, semver).
2. Add entry to `CHANGELOG.md` (Traditional Chinese).
3. Commit with clear message, tag `vX.Y.Z`, push `main` + tags. Owner wants every change auto-pushed.

## Local preview
`python -m http.server 8765` (also in `.claude/launch.json` as `gear-app`).
