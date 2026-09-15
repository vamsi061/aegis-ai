"""Core domain enums and constants shared across layers."""

from enum import StrEnum


class Decision(StrEnum):
    ALLOW = "ALLOW"
    DENY = "DENY"
    REQUIRE_HUMAN_APPROVAL = "REQUIRE_HUMAN_APPROVAL"
    REDACT = "REDACT"
    RATE_LIMIT = "RATE_LIMIT"


# docs/policy-spec.md section 3: stricter decision wins.
DECISION_PRECEDENCE = {
    Decision.DENY: 0,
    Decision.REQUIRE_HUMAN_APPROVAL: 1,
    Decision.REDACT: 2,
    Decision.RATE_LIMIT: 3,
    Decision.ALLOW: 4,
}


class AgentStatus(StrEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    RETIRED = "RETIRED"


# docs/requirements.md FR-02 lifecycle map.
AGENT_LIFECYCLE_TRANSITIONS = {
    AgentStatus.PENDING: {AgentStatus.ACTIVE, AgentStatus.RETIRED},
    AgentStatus.ACTIVE: {AgentStatus.SUSPENDED, AgentStatus.RETIRED},
    AgentStatus.SUSPENDED: {AgentStatus.ACTIVE, AgentStatus.RETIRED},
    AgentStatus.RETIRED: set(),
}


class RiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# docs/policy-spec.md section 6.
RISK_THRESHOLDS = (
    (85, RiskLevel.CRITICAL),
    (60, RiskLevel.HIGH),
    (30, RiskLevel.MEDIUM),
    (0, RiskLevel.LOW),
)


def risk_level_for(score: int) -> RiskLevel:
    for threshold, level in RISK_THRESHOLDS:
        if score >= threshold:
            return level
    return RiskLevel.LOW


class AlertSeverity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertType(StrEnum):
    UNAUTHORIZED_TOOL = "UNAUTHORIZED_TOOL"
    PURPOSE_VIOLATION = "PURPOSE_VIOLATION"
    PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION"
    PROMPT_INJECTION = "PROMPT_INJECTION"
    SUSPENDED_AGENT = "SUSPENDED_AGENT"
    RATE_LIMIT_ABUSE = "RATE_LIMIT_ABUSE"


class GrantStatus(StrEnum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class ApprovalStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    EXPIRED = "EXPIRED"


class DelegationStatus(StrEnum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class EventType(StrEnum):
    AUTHORIZATION_REQUESTED = "AUTHORIZATION_REQUESTED"
    POLICY_DECISION = "POLICY_DECISION"
    GRANT_CREATED = "GRANT_CREATED"
    GRANT_REVOKED = "GRANT_REVOKED"
    APPROVAL_REQUESTED = "APPROVAL_REQUESTED"
    APPROVAL_RESOLVED = "APPROVAL_RESOLVED"
    TOOL_EXECUTION = "TOOL_EXECUTION"
    TOOL_BLOCKED = "TOOL_BLOCKED"
    DELEGATION_REQUESTED = "DELEGATION_REQUESTED"
    DELEGATION_GRANTED = "DELEGATION_GRANTED"
    DELEGATION_DENIED = "DELEGATION_DENIED"
    AGENT_LIFECYCLE = "AGENT_LIFECYCLE"
    SECURITY_ALERT = "SECURITY_ALERT"
