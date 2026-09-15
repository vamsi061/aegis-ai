# Aegis AI — API Specification

Base URL:
`/api/v1`

## 1. Agent Registry

### POST /agents
Register an agent.

Request:
```json
{
  "name": "TravelAgent",
  "description": "Travel planning assistant",
  "owner_user_id": "user-001",
  "purpose": "Travel planning and booking",
  "environment": "demo",
  "risk_level": "MEDIUM",
  "data_scope": ["travel_profile"],
  "capabilities": ["flight_search", "hotel_search"]
}
```

Response:
```json
{
  "agent_id": "agent-001",
  "status": "PENDING"
}
```

### GET /agents
List agents.

### GET /agents/{agent_id}
Get agent details.

### PATCH /agents/{agent_id}
Update permitted metadata.

### POST /agents/{agent_id}/suspend
Suspend agent and revoke active grants.

### POST /agents/{agent_id}/retire
Retire agent.

## 2. Authorization

### POST /authorize

Request:
```json
{
  "agent_id": "agent-001",
  "initiating_user_id": "user-001",
  "action": "search_flight",
  "tool": "flight_search",
  "target": "flight_api",
  "input": {
    "from": "HYD",
    "to": "DEL"
  },
  "context": {}
}
```

Response:
```json
{
  "request_id": "req-001",
  "trace_id": "trace-001",
  "decision": "ALLOW",
  "risk_score": 12,
  "policy_id": "TRAVEL-001",
  "policy_version": 1,
  "reason": "Tool is permitted for agent purpose",
  "grant": {
    "grant_id": "grant-001",
    "expires_at": "2026-09-15T12:10:00Z"
  }
}
```

## 3. Tool Execution

### POST /tools/{tool_name}/execute

The caller supplies an Aegis grant.

Request:
```json
{
  "grant_id": "grant-001",
  "input": {}
}
```

The gateway validates:
- grant exists
- grant active
- grant not expired
- agent active
- tool matches grant
- scope matches request

## 4. Human Approval

### GET /approvals
List pending approval requests.

### GET /approvals/{approval_id}
Get approval details.

### POST /approvals/{approval_id}/approve

Request:
```json
{
  "approver_id": "user-admin",
  "reason": "Approved for demo"
}
```

### POST /approvals/{approval_id}/deny

## 5. Delegation

### POST /delegations

Request:
```json
{
  "source_agent_id": "agent-travel",
  "target_agent_id": "agent-finance",
  "requested_scope": {
    "capabilities": ["budget_read"]
  },
  "ttl_seconds": 300
}
```

Response:
```json
{
  "delegation_id": "del-001",
  "status": "ACTIVE",
  "effective_scope": {
    "capabilities": ["budget_read"]
  },
  "expires_at": "2026-09-15T12:15:00Z"
}
```

## 6. MCP Registry

### POST /mcp/servers
Register MCP server.

### GET /mcp/servers
List servers.

### POST /mcp/servers/{server_id}/tools
Register tool.

### GET /mcp/tools
List tools.

## 7. Audit

### GET /audit/events
Query events using:
- trace_id
- agent_id
- decision
- event_type
- time range

### GET /audit/traces/{trace_id}
Return the complete user -> agent -> tool -> result lineage.

## 8. Security Alerts

### GET /alerts
List alerts.

### POST /alerts/{alert_id}/resolve
Resolve alert.

## 9. Health

### GET /health
Returns service status.

### GET /ready
Returns readiness including database connectivity.

## 10. API Rules

- Pydantic models for request/response validation.
- Authentication/authorization middleware at API boundary.
- Correlation/trace ID generated or propagated for every request.
- Never return secrets.
- Authorization failures use structured error responses.
- Audit security-sensitive API calls.
