/**
 * Fixtures mirror the exact shapes returned by the live FastAPI backend
 * (captured from http://localhost:8000/api/v1). Tests never invent fields.
 */

import type {
  AccessGrant,
  Agent,
  Approval,
  AuditEvent,
  Intent,
  McpServer,
  McpTool,
  PolicySummary,
  SecurityAlert,
} from '../api/types'

export const agentTravel: Agent = {
  agent_id: '11111111-1111-1111-1111-111111111111',
  name: 'TravelAgent',
  description: 'Travel planning and booking assistant',
  owner_user_id: 'user-001',
  purpose: 'Travel planning and booking',
  environment: 'demo',
  external_identity_id: 'entra-travel-agent-001',
  capabilities: ['flight_search', 'hotel_search', 'travel_profile'],
  data_scope: ['travel_profile'],
  risk_level: 'MEDIUM',
  status: 'ACTIVE',
  created_at: '2026-09-15T09:47:52.712494Z',
  updated_at: '2026-09-15T09:47:52.712494Z',
}

export const agentEmail: Agent = {
  ...agentTravel,
  agent_id: '22222222-2222-2222-2222-222222222222',
  name: 'EmailAgent',
  owner_user_id: 'user-002',
  purpose: 'Email composition and delivery',
  external_identity_id: 'entra-email-agent-001',
  capabilities: ['email_send'],
  risk_level: 'LOW',
}

export const approvalPending: Approval = {
  approval_id: '33333333-3333-3333-3333-333333333333',
  authorization_request_id: 'authreq-0001',
  agent_id: agentTravel.agent_id,
  action: 'payment_transfer',
  tool: 'payment_transfer',
  initiating_user_id: 'user-001',
  reason: 'Amount exceeds auto-approval threshold',
  risk_score: 72,
  status: 'PENDING',
  requested_at: '2026-09-15T10:00:00.000000Z',
  expires_at: '2026-09-15T11:00:00.000000Z',
  resolved_by: null,
  resolution_reason: null,
}

export const grantActive: AccessGrant = {
  grant_id: '44444444-4444-4444-4444-444444444444',
  agent_id: agentTravel.agent_id,
  tool_name: 'flight_search',
  tool_id: null,
  scope: { capabilities: ['flight_search'] },
  trace_id: 'trace-allow-001',
  issued_at: '2026-09-15T10:00:00.000000Z',
  expires_at: '2026-09-15T10:05:00.000000Z',
  status: 'ACTIVE',
}

const intentFor = (action: string, tool: string): Intent => ({
  action,
  target: null,
  tool,
  data_scope: [],
  sensitivity: 'LOW',
  amount: null,
  risk_indicators: [],
  source: 'deterministic',
})

export const policyTravelAllow: PolicySummary = {
  policy_key: 'TRAVEL-001',
  name: 'Travel Search Allowed',
  description: 'Travel agents may search flights and hotels.',
  priority: 50,
  status: 'ACTIVE',
  version: 1,
  decision: 'ALLOW',
  updated_at: '2026-09-15T09:47:52.712494Z',
}

export const policyTravelDeny: PolicySummary = {
  ...policyTravelAllow,
  policy_key: 'TRAVEL-002',
  name: 'Travel Financial Block',
  description: 'Travel agents cannot access financial transfer tools.',
  priority: 3,
  decision: 'DENY',
}

export const eventDecisionAllow: AuditEvent = {
  event_id: '55555555-5555-5555-5555-555555555555',
  trace_id: 'trace-allow-001',
  timestamp: '2026-09-15T10:00:00.000000Z',
  event_type: 'POLICY_DECISION',
  action: 'search_flights',
  agent_id: agentTravel.agent_id,
  parent_agent_id: null,
  tool_id: null,
  resource: 'flight_search',
  decision: 'ALLOW',
  risk_score: 12,
  policy_key: 'TRAVEL-001',
  latency_ms: 18,
  token_usage: null,
  estimated_cost: null,
  status: 'ALLOW',
  intent: intentFor('search_flights', 'flight_search'),
  metadata: { policy_key: 'TRAVEL-001' },
}

export const eventDecisionDeny: AuditEvent = {
  ...eventDecisionAllow,
  event_id: '66666666-6666-6666-6666-666666666666',
  trace_id: 'trace-deny-001',
  action: 'payment_transfer',
  resource: 'payment_transfer',
  decision: 'DENY',
  risk_score: 68,
  policy_key: 'TRAVEL-002',
  status: 'DENY',
  intent: intentFor('payment_transfer', 'payment_transfer'),
  metadata: { policy_key: 'TRAVEL-002' },
}

export const alertCritical: SecurityAlert = {
  alert_id: '77777777-7777-7777-7777-777777777777',
  alert_type: 'PROMPT_INJECTION',
  severity: 'CRITICAL',
  status: 'OPEN',
  agent_id: agentEmail.agent_id,
  trace_id: 'trace-injection-001',
  description: 'Potential instruction override and data exfiltration attempt',
  created_at: '2026-09-15T10:05:00.000000Z',
  resolved_at: null,
}

export const mcpServer: McpServer = {
  server_id: '88888888-8888-8888-8888-888888888888',
  name: 'travel-mcp',
  endpoint: 'http://mcp-travel:9000',
  status: 'ACTIVE',
  created_at: '2026-09-15T09:47:52.712494Z',
}

export const toolFlightSearch: McpTool = {
  tool_id: '99999999-9999-9999-9999-999999999999',
  server_id: mcpServer.server_id,
  name: 'flight_search',
  description: 'Search available flights',
  risk_level: 'LOW',
  status: 'ACTIVE',
}

export const toolPaymentTransfer: McpTool = {
  ...toolFlightSearch,
  tool_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'payment_transfer',
  description: 'Transfer funds',
  risk_level: 'CRITICAL',
}
