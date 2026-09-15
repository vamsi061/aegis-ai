"""Policy Decision Point — deterministic, fail-closed (FR-05, NFR-01).

Evaluation order (docs/policy-spec.md section 3 — most restrictive wins):
1. SECURITY-001 hard gate: non-ACTIVE agent -> DENY.
2. INJECTION-001 hard gate: injection/exfiltration indicators -> DENY + alert.
3. MCP-001 structural gate: unregistered/inactive tool or missing capability -> DENY.
4. Declarative policies (TRAVEL/FIN/EMAIL/...): all matching candidates compete
   and the most restrictive decision wins (ties: higher risk score).
5. No match -> DENY (fail closed).
"""

from aegis.domain import Decision
from aegis.engine import seed_policies
from aegis.engine.risk import compute_risk
from aegis.engine.types import PolicyContext, PolicyResult, conditions_match

_INJECTION_INDICATORS = ("data_exfiltration", "instruction_override")


def _mcp_guard(ctx: PolicyContext) -> PolicyResult | None:
    """MCP-001: tool must be registered/active and capability must exist."""
    if not ctx.tool_registered or (ctx.tool_status or "").upper() != "ACTIVE":
        return PolicyResult(
            decision=Decision.DENY,
            reason="Tool is not a registered, active MCP tool (MCP-001)",
            policy_key="MCP-001",
            policy_version=1,
            risk_score=min(compute_risk(ctx) + 25, 100),
            matched_conditions={
                "tool_registered": ctx.tool_registered,
                "tool_status": ctx.tool_status,
            },
        )
    if ctx.tool not in (ctx.capabilities or []):
        return PolicyResult(
            decision=Decision.DENY,
            reason="Agent does not hold the capability for this tool (MCP-001)",
            policy_key="MCP-001",
            policy_version=1,
            risk_score=min(compute_risk(ctx) + 15, 100),
            matched_conditions={"capability_required": ctx.tool},
        )
    return None


def evaluate_policy(ctx: PolicyContext) -> PolicyResult:
    """Evaluate hard gates, then declarative policies."""
    status = (ctx.agent_status or "").upper()
    if status != "ACTIVE":
        return PolicyResult(
            decision=Decision.DENY,
            reason="Agent is not ACTIVE (suspended, retired or pending activation) (SECURITY-001)",
            policy_key="SECURITY-001",
            policy_version=1,
            risk_score=max(compute_risk(ctx), 70),
        )

    hits = [i for i in (ctx.intent.risk_indicators or []) if i in _INJECTION_INDICATORS]
    if hits:
        return PolicyResult(
            decision=Decision.DENY,
            reason="Prompt-injection / data-exfiltration indicators detected (INJECTION-001)",
            policy_key="INJECTION-001",
            policy_version=1,
            risk_score=95,
            matched_conditions={"indicators": hits, "alert": "PROMPT_INJECTION"},
        )

    mcp = _mcp_guard(ctx)
    if mcp is not None:
        return mcp

    best: PolicyResult | None = None
    for policy in seed_policies.SEED_POLICIES:
        if policy.get("dynamic"):
            # Structural policies handled above (MCP) or by the delegation service.
            continue
        if not conditions_match(ctx, policy["conditions"]):
            continue
        decision = Decision(policy["decision"])
        result = PolicyResult(
            decision=decision,
            reason=policy["reason"],
            policy_key=policy["policy_key"],
            policy_version=policy.get("version", 1),
            risk_score=compute_risk(ctx),
            matched_conditions=dict(policy["conditions"]),
            ttl_seconds=policy.get("constraints", {}).get("ttl_seconds", 300),
        )
        if decision is Decision.REQUIRE_HUMAN_APPROVAL:
            result.requires_approval = True
        alert = policy.get("constraints", {}).get("alert")
        if alert:
            result.matched_conditions["alert"] = alert
        if best is None or result.more_restrictive_than(best):
            best = result

    if best is None:
        return PolicyResult(
            decision=Decision.DENY,
            reason="No policy matched this request; failing closed",
            policy_key="FAIL-CLOSED",
            policy_version=1,
            risk_score=min(compute_risk(ctx) + 10, 100),
        )
    return best
