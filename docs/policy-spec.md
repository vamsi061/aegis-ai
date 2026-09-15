# Aegis AI — Policy Specification

## 1. Policy Philosophy

Policy determines authorization. The LLM does not determine authorization.

```text
Natural-language request
        |
        v
Intent extraction
        |
        v
Normalized intent
        |
        v
Deterministic policy evaluation
        |
        +--> ALLOW
        +--> DENY
        +--> REQUIRE_HUMAN_APPROVAL
        +--> REDACT
        +--> RATE_LIMIT
```

## 2. Policy Structure

```yaml
policy_id: TRAVEL-001
version: 1
name: Travel Search Access
priority: 100
status: ACTIVE

conditions:
  agent_purpose:
    equals: "Travel planning and booking"
  tool:
    in:
      - flight_search
      - hotel_search
  agent_status:
    equals: ACTIVE

decision: ALLOW

constraints:
  ttl_seconds: 300
```

## 3. Decision Precedence

Recommended precedence:

1. DENY / explicit security block
2. REQUIRE_HUMAN_APPROVAL
3. REDACT
4. RATE_LIMIT
5. ALLOW

A more restrictive matching policy wins when priorities conflict.

## 4. Required Demo Policies

### Policy TRAVEL-001
TravelAgent -> flight_search -> ALLOW.

### Policy TRAVEL-002
TravelAgent -> payment_transfer -> DENY.

Reason:
`Requested capability is outside the agent's declared purpose and capability set.`

### Policy FIN-001
FinanceAgent -> transfer >= configured threshold -> REQUIRE_HUMAN_APPROVAL.

### Policy MCP-001
Only registered agents with explicit capability may invoke an MCP tool.

### Policy DELEGATION-001
A source agent may delegate only capabilities it currently possesses, and the delegated scope may not exceed the source scope.

### Policy SECURITY-001
Suspended/retired agents -> DENY.

### Policy INJECTION-001
Requests containing high-confidence data-exfiltration or instruction-override indicators -> DENY + security alert.

## 5. Intent Schema

```json
{
  "action": "financial_transfer",
  "target": "account_1234",
  "tool": "payment_transfer",
  "data_scope": [],
  "amount": 50000,
  "sensitivity": "HIGH",
  "risk_indicators": [
    "financial_transaction"
  ]
}
```

## 6. Risk Scoring

Prototype risk scoring can be deterministic:

- LOW: 0-29
- MEDIUM: 30-59
- HIGH: 60-84
- CRITICAL: 85-100

Example factors:
- sensitive data
- financial transaction
- external communication
- destructive action
- privilege escalation attempt
- unknown tool
- prompt injection indicator
- unusual delegation

Risk scoring supports the decision but should not replace explicit policy.

## 7. JIT Rules

An ALLOW decision may create a grant only if:
- agent is ACTIVE
- requested tool is registered
- capability is authorized
- scope is compatible
- expiry is set

Default demo TTL: 5 minutes.

## 8. Delegation Rules

Effective delegated scope:

```text
effective_scope =
    requested_scope
    INTERSECT
    source_effective_scope
    INTERSECT
    target_allowed_capabilities
```

If the intersection is empty -> DENY.

## 9. Policy Versioning

Policy decisions must store:
- policy ID
- policy version
- decision
- reason
- timestamp

Historical decisions must remain interpretable after a policy changes.

## 10. Fail-Closed Rules

DENY when:
- agent does not exist
- agent is suspended/retired
- tool is not registered
- grant expired
- delegation invalid
- policy cannot be evaluated safely
- required approval is missing
