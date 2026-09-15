"""Read-only policy registry endpoints (UI: governance control plane view).

Policies themselves are defined as code (aegis/engine/seed_policies.py) and
synced into the policies/policy_versions tables by the seeder. These endpoints
expose the registry — they never evaluate or mutate policy semantics.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegis.db import get_session
from aegis.models import Policy, PolicyVersion
from aegis.schemas import PolicyDetailOut, PolicyOut, PolicyVersionOut
from aegis.api.deps import not_found

router = APIRouter(prefix="/policies", tags=["policies"])


def _version_out(v: PolicyVersion) -> PolicyVersionOut:
    definition = v.definition or {}
    return PolicyVersionOut(
        version=v.version,
        decision=v.decision,
        conditions=definition.get("conditions", {}),
        created_at=v.created_at,
    )


async def _load_versions(session: AsyncSession, policy_id) -> list[PolicyVersion]:
    result = await session.execute(
        select(PolicyVersion)
        .where(PolicyVersion.policy_id == policy_id)
        .order_by(PolicyVersion.version.asc())
    )
    return list(result.scalars().all())


@router.get("", response_model=list[PolicyOut])
async def list_policies(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(Policy).order_by(Policy.priority.asc(), Policy.policy_key.asc())
    )).scalars().all()
    out: list[PolicyOut] = []
    for p in rows:
        versions = await _load_versions(session, p.id)
        latest = max(versions, key=lambda v: v.version) if versions else None
        out.append(
            PolicyOut(
                policy_key=p.policy_key,
                name=p.name,
                description=p.description,
                priority=p.priority,
                status=p.status,
                version=latest.version if latest else 1,
                decision=latest.decision if latest else "DENY",
                updated_at=p.updated_at,
            )
        )
    return out


@router.get("/{policy_key}", response_model=PolicyDetailOut)
async def get_policy(policy_key: str, session: AsyncSession = Depends(get_session)):
    p = (await session.execute(
        select(Policy).where(Policy.policy_key == policy_key)
    )).scalars().first()
    if p is None:
        raise not_found("Policy not found", "POLICY_NOT_FOUND")
    versions = await _load_versions(session, p.id)
    latest = max(versions, key=lambda v: v.version) if versions else None
    return PolicyDetailOut(
        policy_key=p.policy_key,
        name=p.name,
        description=p.description,
        priority=p.priority,
        status=p.status,
        version=latest.version if latest else 1,
        decision=latest.decision if latest else "DENY",
        updated_at=p.updated_at,
        versions=[_version_out(v) for v in versions],
    )
