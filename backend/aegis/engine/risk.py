"""Deterministic risk scoring (docs/policy-spec.md section 6)."""

from aegis.engine.types import PolicyContext

# Additive weights; the score is clamped to 0..100.
_BASE = 5

_FACTORS: list[tuple[str, int]] = [
    ("sensitive_data", 20),
    ("financial_transaction", 25),
    ("external_communication", 20),
    ("destructive_action", 30),
    ("privilege_escalation_attempt", 45),
    ("unknown_tool", 25),
    ("prompt_injection_indicator", 50),
    ("unusual_delegation", 15),
]

_SENSITIVITY_WEIGHTS = {"LOW": 0, "MEDIUM": 10, "HIGH": 20, "CRITICAL": 35}

_TOOL_RISK_WEIGHTS = {"LOW": 0, "MEDIUM": 8, "HIGH": 18, "CRITICAL": 30}


def compute_risk(ctx: PolicyContext) -> int:
    score = _BASE
    indicators = set(ctx.intent.risk_indicators or [])
    for name, weight in _FACTORS:
        if name in indicators:
            score += weight
    score += _SENSITIVITY_WEIGHTS.get((ctx.intent.sensitivity or "LOW").upper(), 0)
    score += _TOOL_RISK_WEIGHTS.get((ctx.tool_risk_level or "LOW").upper(), 0)
    if ctx.intent.amount is not None and ctx.intent.amount >= 25000:
        score += 10
    if (ctx.intent.sensitivity or "LOW").upper() == "CRITICAL":
        score = min(score + 10, 100)
    return max(0, min(score, 100))
