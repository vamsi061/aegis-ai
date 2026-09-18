# Aegis AI — Coding Agent Handoff

These documents are the source of truth for the first implementation of the Agentic AI Governance Framework.

## Run it (one command)

```bash
./dev.sh
```

Starts PostgreSQL (if needed), the FastAPI backend on `:8000` and the Vite
governance console on `:5173`. First run also creates `backend/.env`,
the Python venv and installs npm dependencies. `Ctrl+C` stops both servers.

- Console: http://localhost:5173
- API: http://localhost:8000/api/v1 — Swagger: http://localhost:8000/docs
- Tests: `cd backend && .venv/bin/python -m pytest` · `cd frontend && npm test`

## Documents

- `docs/requirements.md` — functional and non-functional requirements
- `docs/architecture.md` — system architecture and security boundaries
- `docs/schema.md` — PostgreSQL data model
- `docs/api-spec.md` — REST API contracts
- `docs/policy-spec.md` — policy model and authorization semantics
- `docs/demo-scenarios.md` — acceptance tests and judge demo flow

## Implementation rule

Coding agents must read these documents before changing architecture or contracts. If an implementation conflicts with a requirement, document the conflict instead of silently changing the requirement.
