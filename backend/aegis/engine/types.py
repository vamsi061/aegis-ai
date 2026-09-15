"""Core domain types: Intent, PolicyContext, PolicyResult, policy conditions."""

import re
from dataclasses import dataclass, field
from typing import Any

from aegis.domain import DECISION_PRECEDENCE, Decision


@dataclass
class Intent:
    """Normalized intent (docs/policy-spec.md section 5)."""

    action: str
    target: str | None = None
    tool: str | None = None
    data_scope: list[str] = field(default_factory=list)
    sensitivity: str = "LOW"
    amount: float | None = None
    risk_indicators: list[str] = field(default_factory=list)
    source: str = "deterministic"

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "target": self.target,
            "tool": self.tool,
            "data_scope": list(self.data_scope),
            "sensitivity": self.sensitivity,
            "amount": self.amount,
            "risk_indicators": list(self.risk_indicators),
            "source": self.source,
        }


@dataclass
class PolicyContext:
    """Everything the PDP may look at when deciding (FR-05)."""

    agent_id: str
    agent_name: str
    agent_status: str
    purpose: str
    owner_user_id: str
    environment: str
    capabilities: list[str]
    action: str
    tool: str
    target: str | None
    intent: Intent
    payload: dict[str, Any]
    context: dict[str, Any]
    delegation_chain: list[dict[str, Any]] = field(default_factory=list)
    tool_registered: bool = False
    tool_status: str | None = None
    tool_risk_level: str = "LOW"


@dataclass
class PolicyResult:
    decision: Decision
    reason: str
    policy_key: str
    policy_version: int
    risk_score: int
    matched_conditions: dict[str, Any] = field(default_factory=dict)
    ttl_seconds: int = 300
    requires_approval: bool = False

    def more_restrictive_than(self, other: "PolicyResult") -> bool:
        if DECISION_PRECEDENCE[self.decision] != DECISION_PRECEDENCE[other.decision]:
            return DECISION_PRECEDENCE[self.decision] < DECISION_PRECEDENCE[other.decision]
        return self.risk_score > other.risk_score


# --------------------------------------------------------------------------
# Condition matching: operators used by policy-as-code definitions.
# Condition value: {"equals": x} | {"in": [...]} | {"contains": x} |
#                  {"not_in": [...]} | {"gte": n} | {"exists": true}
# --------------------------------------------------------------------------


def _get_field(ctx: PolicyContext, dotted: str) -> Any:
    obj: Any = ctx
    for part in dotted.split("."):
        if obj is None:
            return None
        if isinstance(obj, dict):
            obj = obj.get(part)
        else:
            obj = getattr(obj, part, None)
    return obj


def _match_op(value: Any, matcher: dict[str, Any]) -> bool:
    if "equals" in matcher:
        if isinstance(value, str) and isinstance(matcher["equals"], str):
            return value.lower() == str(matcher["equals"]).lower()
        return value == matcher["equals"]
    if "in" in matcher:
        items = matcher["in"]
        if isinstance(value, (list, tuple, set)):
            return bool(set(value) & set(items))
        if isinstance(value, str):
            return value.lower() in [str(i).lower() for i in items]
        return value in items
    if "not_in" in matcher:
        return not _match_op(value, {"in": matcher["not_in"]})
    if "contains" in matcher:
        if isinstance(value, (list, tuple, set)):
            return matcher["contains"] in list(value)
        if isinstance(value, str):
            return str(matcher["contains"]).lower() in value.lower()
        return False
    if "contains_any" in matcher:
        wanted = [str(w).lower() for w in matcher["contains_any"]]
        if isinstance(value, (list, tuple, set)):
            return any(str(v).lower() in wanted for v in value)
        if isinstance(value, str):
            return value.lower() in wanted
        return False
    if "gte" in matcher:
        try:
            return value is not None and float(value) >= float(matcher["gte"])
        except (TypeError, ValueError):
            return False
    if "exists" in matcher:
        wanted = bool(matcher["exists"])
        return (value is not None) is wanted
    return False


def _parse_condition(key: str, matcher: Any) -> tuple[str, dict[str, Any]]:
    """Support both {"field": {"op": v}} and legacy {"field.op": v} forms."""
    if isinstance(matcher, dict):
        return key, matcher
    field_name, _, op = key.rpartition(".")
    if not field_name:
        return key, {"equals": matcher}
    return field_name, {op: matcher}


def _conditions_match_inner(ctx: PolicyContext, conditions: dict[str, Any]) -> bool:
    for key, raw in conditions.items():
        if key == "any_of":
            matched = False
            for sub in raw or []:
                if isinstance(sub, dict) and _conditions_match_inner(ctx, sub):
                    matched = True
                    break
            if not matched:
                return False
            continue
        field_name, matcher = _parse_condition(key, raw)
        value = _get_field(ctx, field_name)
        if not _match_op(value, matcher):
            return False
    return True


def conditions_match(ctx: PolicyContext, conditions: dict[str, Any]) -> bool:
    """All conditions must match (AND). Unknown fields -> no match (fail closed)."""
    return _conditions_match_inner(ctx, conditions)


_INJECTION_PATTERNS = [
    (r"ignore\s+(all\s+)?(your\s+)?(previous|prior|original)\s+instructions", "instruction_override"),
    (r"disregard\s+(all\s+)?(previous|prior|your)\s+instructions", "instruction_override"),
    (r"send\s+.{0,40}(data|customer|records?)\s+.{0,20}(external|outside|third)", "data_exfiltration"),
    (r"(email|post|upload|export)\s+.{0,40}(customer|confidential|internal)\s+.{0,20}(data|records)", "data_exfiltration"),
    (r"exfiltrat", "data_exfiltration"),
    (r"reveal\s+(your\s+)?(system\s+)?prompt", "prompt_leak"),
    (r"(you\s+are\s+now|act\s+as)\s+.{0,30}(unrestricted|developer\s+mode|dan)", "role_override"),
]

_INJECTION_COMPILED = [(re.compile(p, re.IGNORECASE), ind) for p, ind in _INJECTION_PATTERNS]


def scan_injection(text: str) -> tuple[bool, list[str]]:
    """Deterministic prompt-injection screen. Demonstrable control, not perfect."""
    indicators: list[str] = []
    for pattern, indicator in _INJECTION_COMPILED:
        if pattern.search(text or ""):
            if indicator not in indicators:
                indicators.append(indicator)
    return bool(indicators), indicators
