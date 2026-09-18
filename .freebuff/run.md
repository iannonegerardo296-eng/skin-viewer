# Preview runbook

## Reproduce artifacts

- Use the repository root as the worktree.
- If this is a fresh worktree, copy `.env.local` from the main checkout into the worktree; do not commit or document its values.
- Install dependencies with `npm install` when `node_modules` is absent or stale.
- Compile the TypeScript backend and dashboard with `npm run build`; this creates `dist/server/index.js` and `dist/src/dashboard.js`.
- The local SQLite database is created automatically at `data/skin-control.sqlite` on first server start. Do not copy or commit that database.

## Run the server

- Start the full dashboard/backend with `npm run dev`.
- Prefer port `8000`; if it is occupied, use `PORT=8001 npm run dev` (PowerShell: `$env:PORT=8001; npm run dev`) and register the matching URL.
- On Windows, start detached with PowerShell using separate stdout/stderr files:
  `powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"`
- Confirm the printed process id remains alive with `Get-Process -Id <pid>` and wait until `http://127.0.0.1:8000/api/health` answers before registering the preview.
