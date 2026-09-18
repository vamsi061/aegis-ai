#!/usr/bin/env bash
# Aegis AI — one-command dev launcher.
#
#   ./dev.sh
#
# Starts, in order:
#   1. PostgreSQL (only if it is not already reachable)
#   2. FastAPI backend  -> http://localhost:8000  (Swagger at /docs)
#   3. Vite frontend    -> http://localhost:5173
#
# A single Ctrl+C stops everything this script started. If a backend is
# already healthy on :8000 it is reused instead of starting a second one.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
BACKEND_PORT=8000
FRONTEND_PORT=5173
BACKEND_URL="http://localhost:$BACKEND_PORT"

G=$'\033[32m'; B=$'\033[34m'; Y=$'\033[33m'; R=$'\033[31m'; D=$'\033[2m'; N=$'\033[0m'
BP=$'[backend]'
FP=$'[frontend]'

log()  { printf '%s[dev]%s %s\n' "$D" "$N" "$*"; }
bmsg() { printf '%s%s%s %s\n' "$G" "$BP" "$N" "$*"; }
fmsg() { printf '%s%s%s %s\n' "$B" "$FP" "$N" "$*"; }
warn() { printf '%s[dev]%s %s\n' "$Y" "$N" "$*"; }
die()  { printf '%s[dev]%s %s\n' "$R" "$N" "$*" >&2; exit 1; }

BACKEND_PID=""
FRONTEND_PID=""
TAIL1=""
TAIL2=""
BACKEND_REUSED=0

cleanup() {
  [ -n "${BEAT_KEEPER:-}" ] && kill "$BEAT_KEEPER" 2>/dev/null
  [ -n "${BEAT:-}" ] && rm -f "$BEAT" 2>/dev/null
  [ -n "$TAIL1" ]        && kill "$TAIL1" 2>/dev/null
  [ -n "$TAIL2" ]        && kill "$TAIL2" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT
trap 'printf "\n%s[dev]%s stopping servers…\n" "$D" "$N"; exit 0' INT TERM

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

wait_http() {
  local url="$1" tries="${2:-40}"
  for _ in $(seq 1 "$tries"); do
    curl -sf -m 2 "$url" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

# --- 0. Prerequisites --------------------------------------------------------
command -v python3 >/dev/null || die "python3 not found — install Python 3.12+"
command -v node    >/dev/null || die "node not found — install Node 18+"
command -v npm     >/dev/null || die "npm not found"
command -v curl    >/dev/null || die "curl not found"

# --- 1. Backend env + venv ---------------------------------------------------
if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  log "created backend/.env from backend/.env.example"
fi

if ! "$BACKEND_DIR/.venv/bin/python" -c 'import uvicorn, fastapi, sqlalchemy' >/dev/null 2>&1; then
  log "backend dependencies missing — creating .venv and installing…"
  rm -rf "$BACKEND_DIR/.venv"
  if command -v uv >/dev/null 2>&1; then
    (cd "$BACKEND_DIR" && uv venv .venv >/dev/null 2>&1 && uv pip install -q -p .venv/bin/python -e '.[dev]') \
      || die "backend dependency install failed (uv)"
  else
    python3 -m venv "$BACKEND_DIR/.venv" || die "could not create virtualenv"
    "$BACKEND_DIR/.venv/bin/pip" install -q --upgrade pip
    (cd "$BACKEND_DIR" && ./.venv/bin/pip install -q -e '.[dev]') \
      || die "backend dependency install failed (pip)"
  fi
  bmsg "dependencies installed."
fi

# --- 2. Database ---------------------------------------------------------------
if ! port_busy 5432; then
  warn "PostgreSQL not reachable on :5432 — attempting to start it…"
  if [ -x /opt/homebrew/opt/postgresql@17/bin/pg_ctl ] && [ -d /opt/homebrew/var/postgresql@17 ]; then
    /opt/homebrew/opt/postgresql@17/bin/pg_ctl \
      -D /opt/homebrew/var/postgresql@17 -l /tmp/aegis-postgres.log start >/dev/null 2>&1 || true
  elif command -v brew >/dev/null 2>&1; then
    brew services start postgresql@17 >/dev/null 2>&1 \
      || brew services start postgresql >/dev/null 2>&1 || true
  fi
  for _ in $(seq 1 10); do port_busy 5432 && break; sleep 1; done
fi

if port_busy 5432; then
  # Best effort: create the demo role/database on a fresh Postgres install.
  if command -v psql >/dev/null 2>&1; then
    PSQL="$(command -v psql)"
    for pg in /opt/homebrew/opt/postgresql@17/bin /opt/homebrew/opt/postgresql/bin; do
      [ -x "$pg/psql" ] && PSQL="$pg/psql" && break
    done
    if ! "$PSQL" -h localhost -U aegis -d aegis -c 'SELECT 1;' >/dev/null 2>&1; then
      log "creating demo role/database (aegis)…"
      "$PSQL" -d postgres -c "CREATE ROLE aegis WITH LOGIN PASSWORD 'aegis' SUPERUSER;" >/dev/null 2>&1 || true
      "$PSQL" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'aegis';" 2>/dev/null | grep -q 1 \
        || "$PSQL" -d postgres -c "CREATE DATABASE aegis OWNER aegis;" >/dev/null 2>&1 || true
    fi
  fi
  log "database ready on :5432"
else
  die "PostgreSQL is not running and could not be started. Start it manually (e.g. 'brew services start postgresql@17') and re-run ./dev.sh"
fi

# --- 3. Frontend deps ----------------------------------------------------------
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  log "frontend dependencies missing — running npm install…"
  (cd "$FRONTEND_DIR" && npm install --no-audit --no-fund) || die "npm install failed"
fi

# --- 4. Ports --------------------------------------------------------------------
if port_busy "$BACKEND_PORT"; then
  if curl -sf -m 2 "$BACKEND_URL/api/v1/health" >/dev/null 2>&1; then
    BACKEND_REUSED=1
    warn "backend already healthy on :$BACKEND_PORT — reusing it"
  else
    die "port $BACKEND_PORT is busy with another service. Free it with: lsof -ti:$BACKEND_PORT | xargs kill"
  fi
fi

# --- 5. Launch ----------------------------------------------------------------------
LOGS="$(mktemp -d /tmp/aegis-dev.XXXXXX)"
BEAT="$LOGS/heartbeat"
# Explicit venv interpreter: on Windows a bare `python` is often the Store shim.
WATCHDOG="$BACKEND_DIR/scripts/watchdog.py"
BLOG="$LOGS/backend.log"
FLOG="$LOGS/frontend.log"

if [ "$BACKEND_REUSED" -eq 0 ]; then
  # The watchdog is the direct parent of uvicorn and ties its lifetime to this
  # script's heartbeat, so the server can never be orphaned (even on SIGKILL).
  cd "$BACKEND_DIR" || die "cannot enter $BACKEND_DIR"
  AEGIS_HEARTBEAT="$BEAT" AEGIS_PORT="$BACKEND_PORT" \
    .venv/bin/python "$WATCHDOG" >"$BLOG" 2>&1 &
  BACKEND_PID=$!
  cd "$ROOT" || true
  bmsg "starting on :$BACKEND_PORT (pid $BACKEND_PID)"
fi

# Vite runs as a direct child of its own watchdog: the watchdog is the parent,
# so it can reap Vite's whole process tree on shutdown.
cd "$FRONTEND_DIR" || die "cannot enter $FRONTEND_DIR"
AEGIS_HEARTBEAT="$BEAT" "$BACKEND_DIR/.venv/bin/python" "$WATCHDOG" -- \
  node_modules/vite/bin/vite.js --port "$FRONTEND_PORT" --strictPort >"$FLOG" 2>&1 &
FRONTEND_PID=$!
cd "$ROOT" || true
fmsg "starting on :$FRONTEND_PORT (pid $FRONTEND_PID)"

tail -n 50 -F "$BLOG" 2>/dev/null | sed "s/^/$G$BP$N /" &
TAIL1=$!
tail -n 50 -F "$FLOG" 2>/dev/null | sed "s/^/$B$FP$N /" &
TAIL2=$!

if [ "$BACKEND_REUSED" -eq 0 ]; then
  if wait_http "$BACKEND_URL/api/v1/health" 40; then
    bmsg "ready -> $BACKEND_URL/api/v1   (Swagger: $BACKEND_URL/docs)"
  else
    warn "backend not healthy yet — full log: $BLOG"
  fi
fi
if wait_http "http://localhost:$FRONTEND_PORT/" 40; then
  fmsg "ready -> http://localhost:$FRONTEND_PORT"
fi

# Keep the heartbeat fresh so the watchdog-wrapped backend stays up.
while :; do : >"$BEAT" 2>/dev/null || true; sleep 2; done &
BEAT_KEEPER=$!

log "console -> http://localhost:$FRONTEND_PORT | api -> $BACKEND_URL/api/v1 | Ctrl+C stops both"

# --- 6. Stay in the foreground until a server exits -----------------------------------
while :; do
  backend_alive=1
  [ "$BACKEND_REUSED" -eq 0 ] && { kill -0 "$BACKEND_PID" 2>/dev/null || backend_alive=0; }
  frontend_alive=1
  kill -0 "$FRONTEND_PID" 2>/dev/null || frontend_alive=0
  : >"$BEAT" 2>/dev/null || true
  [ "$backend_alive" -eq 0 ] && break
  [ "$frontend_alive" -eq 0 ] && break
  sleep 1
done

warn "a server exited — shutting the other one down (logs: $BLOG, $FLOG)"
exit 0
