# CLAUDE.md

Personal multi-activity gear list PWA (hiking = weight mode; diving / skiing / camping = list mode). Single user, not published to any store. Owner is not a programmer — explain changes in plain Traditional Chinese.

## Architecture (no build step)
- `index.html` loads React / lucide-react from esm.sh via import map (sortablejs is dynamic-imported by full URL in app.jsx), and Babel standalone transpiles `app.jsx` in the browser. No Node/npm needed; don't introduce a bundler without asking.
- `gear-data.js` — `ACTIVITIES` (key, title, icon, mode, optional `hidden` = not shown but data kept), one shared list of preset categories, sample gear (for "載入範例清單"), and upgrade helpers `normalizeGear` / `normalizeRecord` / `upgradeLegacyRecord`. Sample ids and activity keys must never be renamed.
- `storage.js` — per-user collections `gear` (`activities: [key]`, optional `order`, `weight` may be null), `records` (`activity`), `meta` (doc `settings`: customCategories, categoryOrder, targetG, lastBackupAt; doc `draft`: `byActivity: { [key]: { checked, title, tempItems } }` plus top-level hiking fields for pre-v3 clients). Not signed in → localStorage; signed in → Firestore `users/{uid}/<collection>` with persistent offline cache. Cloud writes are fire-and-forget (don't await server ack — hangs offline).
- `firestore.rules` — reference copy; must be pasted into Firebase console manually.
- `sw.js` — network-first for own files, cache-first for pinned CDN URLs. On the first open after a release the *previous* SW may still serve a stale index.html, so never make new app.jsx depend on index.html changes (no new import-map entries; dynamic-import new libs by full URL).
- Theme: user picks one of `THEMES` (purple / green / khaki) in ⚙ settings; stored in `meta.settings.theme` + localStorage `gear-theme`; applied as CSS variables (`palette.*` are `var(--*)` strings; canvas export uses the real hex values).
- New gear is created only in the 「全部裝備」 view; activity views add gear by tagging via 「從裝備庫加入」.
- Hosting: GitHub Pages from `main` branch root → https://zzpowertw.github.io/gear-tracker/

## Data compatibility rules (owner's data must survive every update)
- Retiring/merging a category key → add it to `CATEGORY_ALIASES` in gear-data.js (gear is auto-moved on load); never just delete a key.
- Gear without `activities` and records without `activity` are hiking (v2 data) — handled by normalize functions on read, never rewritten in bulk.
- Records are self-contained snapshots: `{ id, activity, title, date, total, items: [{ id, cat, name, note, weight }] }`. Never make records depend on the live gear list.
- Changing a stored shape → add an upgrade function (like `upgradeLegacyRecord`) that runs on read; never require manual migration.
- Backup files carry `schema`; if the backup shape changes, bump `BACKUP_SCHEMA` in app.jsx and teach `normalizeBackup` to read every older schema.
- Import only upserts, never deletes.

## Release checklist (every change)
1. Bump `APP_VERSION` in `app.jsx` **and** `CACHE_VERSION` in `sw.js` (same value, semver).
2. Add entry to `CHANGELOG.md` (Traditional Chinese).
3. Commit with clear message, tag `vX.Y.Z`, push `main` + tags. Owner wants every change auto-pushed.
4. Verify deploy: `gh api repos/zzpowertw/gear-tracker/pages/builds/latest --jq .commit` must equal HEAD. GitHub sometimes skips the Pages build on push — if so, `gh api -X POST repos/zzpowertw/gear-tracker/pages/builds` and check again. Confirm with `curl "https://zzpowertw.github.io/gear-tracker/app.jsx?n=$RANDOM" | grep APP_VERSION`.

## Local preview
`python -m http.server 8765` (also in `.claude/launch.json` as `gear-app`).
