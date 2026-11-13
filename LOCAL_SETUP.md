# WASTELY – Local Setup (Windows 11, verified)

## Requirements
- Node.js LTS (verified with v26.13.0, npm 11.20.0) – `winget install --id OpenJS.NodeJS.LTS -e`
- No local database: data is stored in hosted Firebase Firestore (config in `firebase-applet-config.json`).

> PowerShell blocks `npm.ps1` under the default execution policy. Use `npm.cmd` instead of `npm`
> (no security settings need changing).

## First-time install
```powershell
npm.cmd ci
```

## Run (one terminal)
```powershell
npm.cmd run dev -- --host=127.0.0.1
```
Open http://127.0.0.1:3000/ (localhost only).

## Other scripts
- `npm.cmd run lint` – TypeScript check
- `npm.cmd run build` – production build to `dist/` (used by Netlify)
- `npm.cmd run preview` – serve the built `dist/`

## Stop
Press `Ctrl+C` in the terminal running the dev server.

## Troubleshooting
- `npm.ps1 cannot be loaded` → use `npm.cmd`.
- `node` not found right after install → open a new terminal.
- Port 3000 busy → `npm.cmd run dev -- --host=127.0.0.1 --port=3001`.
- Google sign-in fails on localhost → add `localhost` / `127.0.0.1` under Firebase Console →
  Authentication → Settings → Authorized domains.
- `npm warn install-scripts` / audit warnings: install still works; review with `npm audit` before fixing.
