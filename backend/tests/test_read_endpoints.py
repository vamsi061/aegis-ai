"""Read-only policy & grant registry endpoint tests."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

pytestmark = pytest.mark.asyncio

from aegis.schemas import AuthorizeRequest
from aegis.services.authorization import AuthorizationService


async def test_policies_listed_with_version_and_decision(client, db_session):
    """GET /policies returns the seeded policy registry with latest version."""
    r = await client.get("/api/v1/policies")
    assert r.status_code == 200
    policies = {p["policy_key"]: p for p in r.json()}
    # Seeded registry contains the policy-as-code set.
    for key in ("TRAVEL-001", "TRAVEL-002", "FIN-001", "MCP-001", "SECURITY-001"):
        assert key in policies
    travel = policies["TRAVEL-001"]
    assert travel["decision"] == "ALLOW"
    assert travel["version"] >= 1
    assert travel["status"] == "ACTIVE"
    assert {"policy_key", "name", "priority", "updated_at"} <= set(travel)


async def test_policy_detail_and_404(client, db_session):
    """GET /policies/{key} returns versions+conditions; unknown key -> 404."""
    r = await client.get("/api/v1/policies/FIN-001")
    assert r.status_code == 200
    body = r.json()
    assert body["policy_key"] == "FIN-001"
    assert body["decision"] == "REQUIRE_HUMAN_APPROVAL"
    assert len(body["versions"]) >= 1
    assert "purpose.contains" in body["versions"][-1]["conditions"]

    r2 = await client.get("/api/v1/policies/DOES-NOT-EXIST")
    assert r2.status_code == 404
    assert r2.json()["detail"]["code"] == "POLICY_NOT_FOUND"


async def test_grants_listed_and_active_filter(client, db_session, agent_ids):
    """GET /grants lists grants created by authorization; agent filter works."""
    svc = AuthorizationService(db_session)
    r = await svc.authorize(AuthorizeRequest(
        agent_id=agent_ids["TravelAgent"], action="search_flights",
        tool="flight_search", input={},
    ))
    assert r.decision.value == "ALLOW"
    await db_session.commit()

    resp = await client.get(f"/api/v1/grants?agent_id={agent_ids['TravelAgent']}")
    assert resp.status_code == 200
    grants = resp.json()
    assert len(grants) >= 1
    created = [g for g in grants if g["grant_id"] == r.grant.grant_id]
    assert len(created) == 1
    assert created[0]["status"] == "ACTIVE"
    assert created[0]["tool_name"] == "flight_search"
    assert created[0]["trace_id"] == r.trace_id

    active = await client.get(
        f"/api/v1/grants?agent_id={agent_ids['TravelAgent']}&active_only=true"
    )
    assert any(g["grant_id"] == r.grant.grant_id for g in active.json())

    # Invalid agent uuid -> 422 (query param validation).
    bad = await client.get("/api/v1/grants?agent_id=not-a-uuid")
    assert bad.status_code == 422


async def test_grants_active_only_excludes_expired(client, db_session, agent_ids):
    """active_only=true excludes time-expired grants even with status ACTIVE."""
    from aegis.models import AccessGrant
    from sqlalchemy import select

    svc = AuthorizationService(db_session)
    r = await svc.authorize(AuthorizeRequest(
        agent_id=agent_ids["TravelAgent"], action="search_flights",
        tool="flight_search", input={},
    ))
    await db_session.commit()

    # Force the grant TTL into the past without changing stored status.
    grant = (await db_session.execute(
        select(AccessGrant).where(AccessGrant.id == uuid.UUID(r.grant.grant_id))
    )).scalars().one()
    grant.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.commit()

    active = (await client.get(
        f"/api/v1/grants?agent_id={agent_ids['TravelAgent']}&active_only=true"
    )).json()
    assert all(g["grant_id"] != r.grant.grant_id for g in active)

    all_grants = (await client.get(
        f"/api/v1/grants?agent_id={agent_ids['TravelAgent']}"
    )).json()
    expired = [g for g in all_grants if g["grant_id"] == r.grant.grant_id]
    assert len(expired) == 1
    assert expired[0]["status"] == "EXPIRED"  # effective, not stored, status


async def test_privilege_escalation_denial_is_persisted_over_http(client, db_session, agent_ids):
    """POST /delegations returns 403 AND keeps the denial evidence (alert +
    DELEGATION_DENIED audit event) after the request-scoped rollback."""
    from aegis.models import AuditEvent, SecurityAlert
    from aegis.schemas import DelegationCreate, DelegationScope
    from aegis.services.audit import AuditService
    from sqlalchemy import select

    before_alerts = len((await client.get("/api/v1/alerts")).json())

    resp = await client.post("/api/v1/delegations", json={
        "source_agent_id": agent_ids["TravelAgent"],
        "target_agent_id": agent_ids["EmailAgent"],
        "requested_scope": {"capabilities": ["payment_transfer"]},
        "ttl_seconds": 300,
    })
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "PRIVILEGE_ESCALATION"

    # The security alert must survive the rollback.
    alerts = (await client.get("/api/v1/alerts")).json()
    assert len(alerts) == before_alerts + 1
    assert alerts[0]["alert_type"] == "PRIVILEGE_ESCALATION"
    assert alerts[0]["status"] == "OPEN"

    # And so must the DELEGATION_DENIED audit event on the same trace.
    rows = (await db_session.execute(
        select(AuditEvent)
        .where(
            AuditEvent.event_type == "DELEGATION_DENIED",
            AuditEvent.trace_id == alerts[0]["trace_id"],
        )
    )).scalars().all()
    assert len(rows) == 1
    metadata = rows[0].metadata_json
    assert metadata["policy_key"] == "DELEGATION-001"
    assert "payment_transfer" in metadata["requested"]

    # Alerts endpoint list is backed by the same rows the AuditService wrote.
    listed = await AuditService(db_session).list_alerts()
    assert any(a.alert_type == "PRIVILEGE_ESCALATION" and a.trace_id == alerts[0]["trace_id"] for a in listed)
