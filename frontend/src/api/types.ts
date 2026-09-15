/**
 * Typed API contracts aligned 1:1 with the FastAPI schemas
 * (backend/aegis/schemas/*) — verified against live responses and openapi.json.
 * Do not invent fields; extend only when the backend changes.
 */

export type Decision =
  | 'ALLOW'
  | 'DENY'
  | 'REQUIRE_HUMAN_APPROVAL'
  | 'RATE_LIMIT'

export type AgentStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type GrantStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

// --- Agents -----------------------------------------------------------------

export interface Agent {
  agent_id: string
  external_identity_id: string
  name: string
  description: string | null
  owner_user_id: string
  purpose: string
  environment: string
  risk_level: string
  status: AgentStatus
  data_scope: string[]
  capabilities: string[]
  created_at: string
  updated_at: string
}

// --- Authorization ------------------------------------------------------------

export interface Intent {
  action: string
  target: string | null
  tool: string | null
  data_scope: string[]
  sensitivity: string
  amount: number | null
  risk_indicators: string[]
  source: string
}

export interface GrantInfo {
  grant_id: string
  expires_at: string
  scope: Record<string, unknown>
}

export interface ApprovalNeeded {
  approval_id: string
  expires_at: string
}

export interface AuthorizeResponse {
  request_id: string
  trace_id: string
  decision: Decision
  risk_score: number
  risk_level: string
  policy_id: string | null
  policy_version: number | null
  reason: string
  intent: Intent | null
  grant: GrantInfo | null
  approval: ApprovalNeeded | null
}

export interface ToolExecutionResult {
  status: string
  tool: string
  result: unknown
  trace_id: string
  executed_at: string
}

// --- Approvals ------------------------------------------------------------------

export interface Approval {
  approval_id: string
  authorization_request_id: string
  agent_id: string | null
  tool: string | null
  action: string | null
  initiating_user_id: string | null
  risk_score: number
  reason: string
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'
  requested_at: string
  expires_at: string
  resolved_by: string | null
  resolution_reason: string | null
}

// --- Delegations ------------------------------------------------------------------

export interface Delegation {
  delegation_id: string
  trace_id: string
  source_agent_id: string
  target_agent_id: string
  status: string
  effective_scope: { capabilities: string[] }
  expires_at: string
}

// --- MCP ------------------------------------------------------------------------

export interface McpServer {
  server_id: string
  name: string
  endpoint: string | null
  status: string
  created_at: string
}

export interface McpTool {
  tool_id: string
  server_id: string
  name: string
  description: string | null
  risk_level: string
  status: string
}

// --- Policies ---------------------------------------------------------------------

export interface PolicyVersionInfo {
  version: number
  decision: Decision | string
  conditions: Record<string, unknown>
  created_at: string
}

export interface PolicySummary {
  policy_key: string
  name: string
  description: string | null
  priority: number
  status: string
  version: number
  decision: Decision | string
  updated_at: string
}

export interface PolicyDetail extends PolicySummary {
  versions: PolicyVersionInfo[]
}

// --- Grants ------------------------------------------------------------------------

export interface AccessGrant {
  grant_id: string
  agent_id: string
  tool_name: string | null
  tool_id: string | null
  scope: Record<string, unknown>
  trace_id: string | null
  issued_at: string
  expires_at: string
  status: GrantStatus
}

// --- Audit ---------------------------------------------------------------------------

export interface AuditEvent {
  event_id: string
  trace_id: string
  timestamp: string
  event_type: string
  action: string | null
  agent_id: string | null
  parent_agent_id: string | null
  tool_id: string | null
  resource: string | null
  intent: Intent | null
  decision: Decision | string | null
  policy_key: string | null
  risk_score: number | null
  latency_ms: number | null
  token_usage: number | null
  estimated_cost: number | null
  status: string | null
  metadata: Record<string, unknown>
}

export interface TraceStep {
  seq: number
  event_id: string
  event_type: string
  agent_id: string | null
  action: string | null
  decision: Decision | string | null
  detail: Record<string, unknown>
  timestamp: string
}

export interface TraceDelegation {
  delegation_id: string
  source_agent_id: string
  target_agent_id: string
  status: string
  effective_scope: { capabilities: string[] }
  expires_at: string
}

export interface TraceDetail {
  trace_id: string
  steps: TraceStep[]
  grants: {
    grant_id: string
    tool: string | null
    status: string
    scope: Record<string, unknown>
    issued_at: string
    expires_at: string
  }[]
  delegations: TraceDelegation[]
}

// --- Alerts -----------------------------------------------------------------------------

export interface SecurityAlert {
  alert_id: string
  trace_id: string | null
  agent_id: string | null
  alert_type: string
  severity: AlertSeverity
  description: string
  status: 'OPEN' | 'RESOLVED'
  created_at: string
  resolved_at: string | null
}

// --- Health -----------------------------------------------------------------------------

export interface HealthStatus {
  status: string
  service: string
  environment: string
}

export interface ReadyStatus {
  ready: boolean
  database: string
}
