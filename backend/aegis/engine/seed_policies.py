"""Policies required by docs/policy-spec.md section 4, as code."""

TRAVEL_001 = {
    "policy_key": "TRAVEL-001",
    "name": "Travel Search Access",
    "description": "TravelAgent may search flights/hotels within purpose.",
    "priority": 100,
    "conditions": {
        "purpose.contains": "travel",
        "tool.in": ["flight_search", "hotel_search", "travel_profile_read"],
        "agent_status.equals": "ACTIVE",
    },
    "decision": "ALLOW",
    "reason": "Tool is within the agent's declared purpose and capability set",
    "constraints": {"ttl_seconds": 300},
    "version": 1,
}

TRAVEL_002 = {
    "policy_key": "TRAVEL-002",
    "name": "Travel Financial Block",
    "description": "Travel agents must not move money.",
    "priority": 10,
    "conditions": {
        "purpose.contains": "travel",
        "action.equals": "financial_transfer",
    },
    "decision": "DENY",
    "reason": "Requested capability is outside the agent's declared purpose and capability set",
    "constraints": {},
    "version": 1,
}

FIN_001 = {
    "policy_key": "FIN-001",
    "name": "Finance High Value Approval",
    "description": "Finance transfers at/above the threshold need human approval.",
    "priority": 20,
    "conditions": {
        "purpose.contains": "financ",
        "action.equals": "financial_transfer",
        "intent.amount": {"gte": 10000},
    },
    "decision": "REQUIRE_HUMAN_APPROVAL",
    "reason": "High-value financial transfer requires human approval",
    "constraints": {"approval_ttl_seconds": 900},
    "version": 1,
}

FIN_002 = {
    "policy_key": "FIN-002",
    "name": "Finance Routine Operations",
    "description": "Budget reads and sub-threshold transfers are allowed.",
    "priority": 90,
    "conditions": {
        "purpose.contains": "financ",
        "tool.in": ["budget_read", "payment_transfer"],
        "agent_status.equals": "ACTIVE",
    },
    "decision": "ALLOW",
    "reason": "Tool is within the agent's declared purpose and capability set",
    "constraints": {"ttl_seconds": 300},
    "version": 1,
}

EMAIL_001 = {
    "policy_key": "EMAIL-001",
    "name": "Email Operations",
    "description": "Email agent may read and send mail within purpose.",
    "priority": 100,
    "conditions": {
        "purpose.contains": "email",
        "tool.in": ["email_read", "email_send"],
        "agent_status.equals": "ACTIVE",
    },
    "decision": "ALLOW",
    "reason": "Tool is within the agent's declared purpose and capability set",
    "constraints": {"ttl_seconds": 300},
    "version": 1,
}

MCP_001 = {
    "policy_key": "MCP-001",
    "name": "Registered Tool Required",
    "description": "Only registered tools with explicit capability may be invoked.",
    "priority": 5,
    "conditions": {
        "any_of": [
            {"tool_registered.equals": False},
            {"tool_status.not_in": ["ACTIVE"]},
            {"capabilities.contains_not": "__tool__"},
        ]
    },
    "decision": "DENY",
    "reason": "Tool is not registered or the agent lacks the capability",
    "constraints": {},
    "version": 1,
    "dynamic": "mcp",
}

DELEGATION_001 = {
    "policy_key": "DELEGATION-001",
    "name": "Delegation Scope Confinement",
    "description": "Delegated scope may not exceed source authority.",
    "priority": 10,
    "conditions": {},
    "decision": "ALLOW",
    "reason": "Delegated scope is within source effective scope and target allowed capabilities",
    "constraints": {"max_ttl_seconds": 900},
    "version": 1,
    "dynamic": "delegation",
}

SECURITY_001 = {
    "policy_key": "SECURITY-001",
    "name": "Non-Active Agent Block",
    "description": "Suspended/retired/pending agents are denied.",
    "priority": 1,
    "conditions": {"agent_status.not_in": ["ACTIVE"]},
    "decision": "DENY",
    "reason": "Agent is not ACTIVE (suspended, retired or pending activation)",
    "constraints": {},
    "version": 1,
}

INJECTION_001 = {
    "policy_key": "INJECTION-001",
    "name": "Prompt Injection Block",
    "description": "High-confidence injection/exfiltration indicators are denied.",
    "priority": 2,
    "conditions": {"intent.risk_indicators.contains_any": ["data_exfiltration", "instruction_override"]},
    "decision": "DENY",
    "reason": "Prompt-injection / data-exfiltration indicators detected",
    "constraints": {"alert": "PROMPT_INJECTION"},
    "version": 1,
}

SEED_POLICIES: list[dict] = [
    SECURITY_001,
    INJECTION_001,
    MCP_001,
    TRAVEL_002,
    FIN_001,
    DELEGATION_001,
    TRAVEL_001,
    FIN_002,
    EMAIL_001,
]
