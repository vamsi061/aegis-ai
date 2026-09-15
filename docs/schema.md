# Aegis AI — Database Schema

PostgreSQL is the system of record for governance metadata and audit data.

## 1. Core Tables

### agents
```sql
id UUID PRIMARY KEY
external_identity_id VARCHAR(255) UNIQUE NOT NULL
name VARCHAR(255) NOT NULL
description TEXT
owner_user_id UUID NOT NULL
purpose TEXT NOT NULL
environment VARCHAR(50) NOT NULL
risk_level VARCHAR(20) NOT NULL
status VARCHAR(20) NOT NULL
data_scope JSONB NOT NULL DEFAULT '[]'
metadata JSONB NOT NULL DEFAULT '{}'
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
expires_at TIMESTAMPTZ
```

### agent_capabilities
```sql
id UUID PRIMARY KEY
agent_id UUID REFERENCES agents(id)
tool_id UUID
capability VARCHAR(255) NOT NULL
scope JSONB NOT NULL DEFAULT '{}'
enabled BOOLEAN NOT NULL DEFAULT TRUE
created_at TIMESTAMPTZ NOT NULL
```

### agent_lifecycle_events
```sql
id UUID PRIMARY KEY
agent_id UUID REFERENCES agents(id)
from_status VARCHAR(20)
to_status VARCHAR(20) NOT NULL
actor_user_id UUID
reason TEXT
created_at TIMESTAMPTZ NOT NULL
```

## 2. Policy Tables

### policies
```sql
id UUID PRIMARY KEY
policy_key VARCHAR(255) UNIQUE NOT NULL
name VARCHAR(255) NOT NULL
description TEXT
priority INTEGER NOT NULL DEFAULT 100
status VARCHAR(20) NOT NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

### policy_versions
```sql
id UUID PRIMARY KEY
policy_id UUID REFERENCES policies(id)
version INTEGER NOT NULL
definition JSONB NOT NULL
decision VARCHAR(40) NOT NULL
created_by UUID
created_at TIMESTAMPTZ NOT NULL
UNIQUE(policy_id, version)
```

## 3. Access

### access_grants
```sql
id UUID PRIMARY KEY
agent_id UUID REFERENCES agents(id)
intent_id UUID
tool_id UUID
scope JSONB NOT NULL
issued_at TIMESTAMPTZ NOT NULL
expires_at TIMESTAMPTZ NOT NULL
status VARCHAR(20) NOT NULL
revoked_at TIMESTAMPTZ
revocation_reason TEXT
```

## 4. MCP

### mcp_servers
```sql
id UUID PRIMARY KEY
name VARCHAR(255) UNIQUE NOT NULL
endpoint TEXT
status VARCHAR(20) NOT NULL
owner_user_id UUID
metadata JSONB NOT NULL DEFAULT '{}'
created_at TIMESTAMPTZ NOT NULL
```

### mcp_tools
```sql
id UUID PRIMARY KEY
server_id UUID REFERENCES mcp_servers(id)
name VARCHAR(255) NOT NULL
description TEXT
risk_level VARCHAR(20) NOT NULL
input_schema JSONB
status VARCHAR(20) NOT NULL
UNIQUE(server_id, name)
```

## 5. Intent and Decisions

### authorization_requests
```sql
id UUID PRIMARY KEY
trace_id VARCHAR(128) NOT NULL
agent_id UUID REFERENCES agents(id)
initiating_user_id UUID
action VARCHAR(255) NOT NULL
target VARCHAR(255)
tool_id UUID
intent JSONB NOT NULL
context JSONB NOT NULL DEFAULT '{}'
created_at TIMESTAMPTZ NOT NULL
```

### policy_decisions
```sql
id UUID PRIMARY KEY
authorization_request_id UUID REFERENCES authorization_requests(id)
policy_id UUID REFERENCES policies(id)
policy_version INTEGER
decision VARCHAR(40) NOT NULL
reason TEXT NOT NULL
risk_score INTEGER
created_at TIMESTAMPTZ NOT NULL
```

## 6. A2A Delegation

### delegations
```sql
id UUID PRIMARY KEY
trace_id VARCHAR(128) NOT NULL
source_agent_id UUID REFERENCES agents(id)
target_agent_id UUID REFERENCES agents(id)
parent_delegation_id UUID REFERENCES delegations(id)
requested_scope JSONB NOT NULL
effective_scope JSONB NOT NULL
status VARCHAR(20) NOT NULL
issued_at TIMESTAMPTZ NOT NULL
expires_at TIMESTAMPTZ NOT NULL
revoked_at TIMESTAMPTZ
```

## 7. Human Approval

### approval_requests
```sql
id UUID PRIMARY KEY
authorization_request_id UUID REFERENCES authorization_requests(id)
risk_score INTEGER NOT NULL
reason TEXT NOT NULL
status VARCHAR(20) NOT NULL
requested_at TIMESTAMPTZ NOT NULL
expires_at TIMESTAMPTZ NOT NULL
resolved_at TIMESTAMPTZ
resolved_by UUID
resolution_reason TEXT
```

## 8. Audit

### audit_events
```sql
id UUID PRIMARY KEY
trace_id VARCHAR(128) NOT NULL
parent_event_id UUID
timestamp TIMESTAMPTZ NOT NULL
initiating_user_id UUID
agent_id UUID
parent_agent_id UUID
event_type VARCHAR(100) NOT NULL
action VARCHAR(255)
tool_id UUID
resource VARCHAR(255)
intent JSONB
decision VARCHAR(40)
policy_id UUID
risk_score INTEGER
latency_ms INTEGER
token_usage INTEGER
estimated_cost NUMERIC(18,8)
status VARCHAR(40)
metadata JSONB NOT NULL DEFAULT '{}'
```

## 9. Security Alerts

### security_alerts
```sql
id UUID PRIMARY KEY
trace_id VARCHAR(128)
agent_id UUID
alert_type VARCHAR(100) NOT NULL
severity VARCHAR(20) NOT NULL
description TEXT NOT NULL
status VARCHAR(20) NOT NULL
created_at TIMESTAMPTZ NOT NULL
resolved_at TIMESTAMPTZ
```

## 10. Design Rules

- UUIDs for internal identifiers.
- JSONB for evolving intent/context/policy metadata.
- Timestamps stored in UTC.
- Audit events are append-only from the application perspective.
- Index `trace_id`, `agent_id`, `created_at`, `decision`, and `severity`.
- Never store real secrets in these tables.
