# Aegis AI — Architecture

## 1. Architectural Principle

Aegis AI is a governance control plane between AI agents and enterprise resources.

```text
User / Application
       |
       v
+---------------------------+
|        AI Agent(s)        |
+-------------+-------------+
              |
              v
+---------------------------+
|      Aegis Gateway        |
|---------------------------|
| Identity Context          |
| Intent Analysis           |
| Policy Decision Point     |
| JIT Authorization         |
| Human Approval            |
| A2A Delegation            |
| MCP/Tool Authorization    |
| Audit + Lineage           |
+-------------+-------------+
              |
       +------+------+
       |             |
       v             v
 Enterprise       MCP/API/
 Resources        Tool Layer
```

## 2. Components

### 2.1 API Gateway
FastAPI entry point for:
- agent management
- authorization requests
- approvals
- tool invocation
- delegation
- audit queries

### 2.2 Agent Registry
Owns agent metadata and lifecycle.

### 2.3 Intent Engine
Converts an agent request into a normalized intent object.

Important rule: the LLM can interpret intent, but authorization remains deterministic.

### 2.4 Policy Decision Point (PDP)
Central authorization engine.

Inputs:
- identity
- intent
- purpose
- capabilities
- resource/tool
- context
- delegation chain

Output:
```json
{
  "decision": "ALLOW",
  "policy_id": "TRAVEL-001",
  "policy_version": 3,
  "reason": "Tool is within declared purpose",
  "risk_score": 12
}
```

### 2.5 JIT Authorization Service
Creates short-lived task-scoped grants after an allow/approval decision.

### 2.6 Approval Service
Creates and resolves human approval requests.

### 2.7 MCP/Tool Gateway
Single controlled execution boundary for tools.

No agent should call a governed tool directly in the demo architecture.

### 2.8 A2A Delegation Service
Issues constrained delegation grants and records parent/child relationships.

### 2.9 Audit/Lineage Service
Persists security events and creates trace relationships.

### 2.10 Observability
OpenTelemetry instrumentation for request, policy, authorization, tool execution, and delegation spans.

## 3. Deployment Topology

Prototype:

```text
React SPA
   |
FastAPI
   |
+--+-----------------------------+
|                                |
PostgreSQL                   OpenTelemetry
|                                |
+-- Registry                    +-- traces
+-- Policies                    +-- metrics
+-- Grants                      +-- logs
+-- Delegations
+-- Approvals
+-- Audit
```

## 4. Runtime Authorization Sequence

```text
Agent
 |
 | authorization request
 v
Aegis API
 |
 +--> Load agent identity/purpose
 |
 +--> Extract/normalize intent
 |
 +--> Resolve tool/resource
 |
 +--> Validate delegation chain
 |
 +--> Evaluate policy
 |
 +---- DENY --------------------------> Audit + Alert
 |
 +---- APPROVAL --> Human --> Decision
 |
 +---- ALLOW
        |
        v
   Create JIT Grant
        |
        v
   Tool/MCP Gateway
        |
        v
   Execute
        |
        v
   Audit + Trace
```

## 5. Adapter Boundaries

Interfaces must exist for:
- IdentityProvider
- IntentProvider
- PolicyEvaluator
- CredentialProvider
- ToolExecutor
- ApprovalProvider
- TelemetryProvider

This allows mock implementations during development and enterprise integrations later.

## 6. Security Architecture

### Fail Closed
Unknown agent, suspended agent, expired grant, invalid delegation, unavailable policy, or unauthorized tool should not result in execution.

### Least Privilege
Delegated access cannot exceed the source agent's effective capability.

### Purpose Binding
An agent may only access capabilities compatible with its declared purpose and policy.

### Time Binding
Grants and delegations have explicit expiry.

### Revocation
Agent suspension and security incidents can invalidate active grants.

## 7. Technology Stack

Specified by the challenge:
- Python 3.14+
- FastAPI
- Pydantic
- React
- TypeScript
- PostgreSQL
- OpenTelemetry
- Microsoft Entra Agent ID integration

The prototype should isolate Azure/Entra-specific components so the core governance engine remains testable locally.
