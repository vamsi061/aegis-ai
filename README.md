# Aegis AI — Coding Agent Handoff

These documents are the source of truth for the first implementation of the Agentic AI Governance Framework.

## Run it (one command)

**Windows** — double-click `dev.bat`, or from PowerShell:

```powershell
.\dev.ps1
```

**macOS / Linux / Git Bash / WSL:**

```bash
./dev.sh
```

Either launcher starts PostgreSQL (if needed), the FastAPI backend on `:8000`
and the Vite governance console on `:5173`. The first run also creates
`backend/.env`, the Python venv and installs npm dependencies.
`Ctrl+C` stops both servers.

- Console: http://localhost:5173
- API: http://localhost:8000/api/v1 — Swagger: http://localhost:8000/docs
- Tests: `cd backend && .venv/bin/python -m pytest` · `cd frontend && npm test`
- Demo run: `python backend/scripts/demo.py`

Both launchers track their child processes, so the servers cannot be left
orphaned — even if the terminal window is closed or the launcher is killed hard.
(The backend and frontend each run under `backend/scripts/watchdog.py`.)

## Windows setup

### 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Python | 3.12+ | Get it from python.org (not the Microsoft Store build) |
| Node.js | 18+ | Includes `npm` |
| PostgreSQL | 14+ | Must be **running** before you launch |

During the Python installer, tick **"Add python.exe to PATH"**.

Verify in a new PowerShell window:

```powershell
python --version
node --version
npm --version
psql --version
```

### 2. Database

`dev.ps1` looks for PostgreSQL on port `5432` and tries to start the Windows
service for you. On a fresh install, create the demo role and database once:

```powershell
psql -U postgres -c "CREATE ROLE aegis WITH LOGIN PASSWORD 'aegis' SUPERUSER;"
psql -U postgres -c "CREATE DATABASE aegis OWNER aegis;"
```

The launcher attempts this automatically when it can reach `psql` as a
superuser; if it cannot, it prints these exact statements for you to run.

The connection string lives in `backend/.env` (created from
`backend/.env.example` on first run) and defaults to:

```text
postgresql+asyncpg://aegis:aegis@localhost:5432/aegis
```

### 3. Launch

```powershell
.\dev.ps1
```

If PowerShell blocks the script, use `dev.bat` (it already sets
`-ExecutionPolicy Bypass`), or allow local scripts once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 4. Troubleshooting

**`python` opens the Microsoft Store.** The Store alias is shadowing your real
install. Disable it under *Settings → Apps → Advanced app settings → App
execution aliases* (turn off `python.exe` and `python3.exe`), or just keep using
`dev.bat`, which prefers the `py` launcher.

**Port already in use.** Find and stop the process holding it:

```powershell
netstat -ano | findstr :8000
taskkill /PID <pid> /F
```

Replace `8000` with `5173` for the console.

**PostgreSQL is not running.** Open `services.msc`, find the
`postgresql-x64-*` service and start it — or from an admin PowerShell:

```powershell
Start-Service postgresql-x64-17
```

**`uvloop` / build errors during `pip install`.** `uvloop` and `httptools` have
no Windows wheels, so `backend/pyproject.toml` installs `uvicorn[standard]` on
macOS/Linux and plain `uvicorn` on Windows. If you created the venv on another
OS, delete `backend/.venv` and re-run the launcher.

**Backend reachable but the console shows connection errors.** Confirm the API
is up, then reload the page:

```powershell
curl http://localhost:8000/api/v1/ready
```

**`ExecutionPolicy` still blocking.** Run the script directly with an explicit
bypass instead of changing system policy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\dev.ps1
```

## Documents

- `docs/requirements.md` — functional and non-functional requirements
- `docs/architecture.md` — system architecture and security boundaries
- `docs/schema.md` — PostgreSQL data model
- `docs/api-spec.md` — REST API contracts
- `docs/policy-spec.md` — policy model and authorization semantics
- `docs/demo-scenarios.md` — acceptance tests and judge demo flow

## Implementation rule

Coding agents must read these documents before changing architecture or contracts. If an implementation conflicts with a requirement, document the conflict instead of silently changing the requirement.
