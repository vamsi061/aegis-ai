"""HTTP API tests exercising the FastAPI application end-to-end."""

import pytest

pytestmark = pytest.mark.asyncio


async def test_health_and_ready(client):
    r = await client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_agents_listed_over_http(client, db_session):
    r = await client.get("/api/v1/agents")
    assert r.status_code == 200
    names = {a["name"] for a in r.json()}
    assert {"TravelAgent", "FinanceAgent", "EmailAgent"} <= names


async def test_authorize_over_http_allow_and_deny(client, db_session, agent_ids):
    r = await client.post("/api/v1/authorize", json={
        "agent_id": agent_ids["TravelAgent"],
        "action": "search_flights",
        "tool": "flight_search",
        "input": {"from": "HYD", "to": "DEL"},
    })
    assert r.status_code == 200
    body = r.json()
    assert body["decision"] == "ALLOW"
    assert body["grant"]["grant_id"]
    trace_id = body["trace_id"]

    r2 = await client.post("/api/v1/authorize", json={
        "agent_id": agent_ids["TravelAgent"],
        "action": "payment_transfer",
        "tool": "payment_transfer",
        "input": {"amount": 5000},
    })
    assert r2.json()["decision"] == "DENY"

    # Trace lineage is queryable over HTTP.
    r3 = await client.get(f"/api/v1/audit/traces/{trace_id}")
    assert r3.status_code == 200
    steps = r3.json()["steps"]
    assert any(s["event_type"] == "POLICY_DECISION" for s in steps)
    assert len(r3.json()["grants"]) == 1


async def test_tool_execution_over_http(client, db_session, agent_ids):
    r = await client.post("/api/v1/authorize", json={
        "agent_id": agent_ids["TravelAgent"],
        "action": "search_flights",
        "tool": "flight_search",
        "input": {},
    })
    grant_id = r.json()["grant"]["grant_id"]

    r2 = await client.post("/api/v1/tools/flight_search/execute", json={
        "grant_id": grant_id,
        "input": {"from": "HYD", "to": "DEL"},
    })
    assert r2.status_code == 200
    assert r2.json()["status"] == "EXECUTED"

    # Execution without a valid grant is rejected.
    r3 = await client.post("/api/v1/tools/flight_search/execute", json={
        "grant_id": "00000000-0000-0000-0000-000000000000", "input": {},
    })
    assert r3.status_code == 403
