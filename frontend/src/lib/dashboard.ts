/**
 * Derives dashboard aggregates and the hero pipeline view-model from real
 * backend events. No synthetic data: every number traces back to an API
 * response (agents, audit events, alerts, approvals, delegations, grants).
 */

import type {
  Agent,
  AuditEvent,
  Delegation,
  SecurityAlert,
  Approval,
  AccessGrant,
} from '../api/types'
import { riskLevelOf } from '../components/StatusBadge'
import type { PipelineStage } from '../components/GovernancePipeline'

export interface DecisionEvent {
  decision: AuditEvent
  request: AuditEvent | null
  agent: Agent | undefined
}

/** Pair each POLICY_DECISION with its AUTHORIZATION_REQUESTED (for intent). */
export function pairDecisionEvents(
  events: AuditEvent[],
  agents: Agent[],
): DecisionEvent[] {
  const byTrace = new Map<string, AuditEvent>()
  for (const e of events) {
    if (e.event_type === 'AUTHORIZATION_REQUESTED') byTrace.set(e.trace_id, e)
  }
  const agentById = new Map(agents.map((a) => [a.agent_id, a]))
  return events
    .filter((e) => e.event_type === 'POLICY_DECISION')
    .map((decision) => ({
      decision,
      request: byTrace.get(decision.trace_id) ?? null,
      agent: agentById.get(decision.agent_id ?? ''),
    }))
    .reverse() // newest first
}

export interface Kpis {
  activeAgents: number
  totalAgents: number
  authRequests: number
  allowed: number
  denied: number
  approvals: number
  rateLimited: number
  pendingApprovals: number
  openAlerts: number
  activeGrants: number
  activeDelegations: number
  toolInvocations: number
  tokenUsage: number
  estimatedCost: number
  avgLatencyMs: number | null
}

export function computeKpis(
  agents: Agent[],
  decisions: AuditEvent[],
  toolExecutions: AuditEvent[],
  pendingApprovals: Approval[],
  alerts: SecurityAlert[],
  activeGrants: AccessGrant[],
  delegations: Delegation[],
): Kpis {
  const byDecision = (d: string) => decisions.filter((e) => e.decision === d).length
  const latencies = decisions.map((e) => e.latency_ms).filter((v): v is number => v != null)
  return {
    activeAgents: agents.filter((a) => a.status === 'ACTIVE').length,
    totalAgents: agents.length,
    authRequests: decisions.length,
    allowed: byDecision('ALLOW'),
    denied: byDecision('DENY'),
    approvals: byDecision('REQUIRE_HUMAN_APPROVAL'),
    rateLimited: byDecision('RATE_LIMIT'),
    pendingApprovals: pendingApprovals.length,
    openAlerts: alerts.filter((a) => a.status === 'OPEN').length,
    activeGrants: activeGrants.filter((g) => g.status === 'ACTIVE').length,
    activeDelegations: delegations.filter((d) => d.status === 'ACTIVE').length,
    toolInvocations: toolExecutions.length,
    tokenUsage: toolExecutions.reduce((sum, e) => sum + (e.token_usage ?? 0), 0),
    estimatedCost: toolExecutions.reduce((sum, e) => sum + (e.estimated_cost ?? 0), 0),
    avgLatencyMs:
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
  }
}

export interface RiskBucket {
  level: string
  count: number
}

export function riskDistribution(decisions: AuditEvent[]): RiskBucket[] {
  const counts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
  for (const e of decisions) {
    counts[riskLevelOf(e.risk_score)] += 1
  }
  return Object.entries(counts).map(([level, count]) => ({ level, count }))
}

export interface ActivityBucket {
  time: string
  ALLOW: number
  DENY: number
  APPROVAL: number
}

export function decisionActivity(decisions: AuditEvent[]): ActivityBucket[] {
  const buckets = new Map<string, ActivityBucket>()
  for (const e of decisions) {
    const d = new Date(e.timestamp)
    const key = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const bucket = buckets.get(key) ?? { time: key, ALLOW: 0, DENY: 0, APPROVAL: 0 }
    if (e.decision === 'ALLOW') bucket.ALLOW += 1
    else if (e.decision === 'DENY') bucket.DENY += 1
    else if (e.decision === 'REQUIRE_HUMAN_APPROVAL') bucket.APPROVAL += 1
    buckets.set(key, bucket)
  }
  return [...buckets.values()]
}

/** Build the hero pipeline from a selected decision event + its request. */
export function pipelineFromEvents(pair: DecisionEvent): PipelineStage[] {
  const { decision, request, agent } = pair
  const meta = decision.metadata as {
    policy_key?: string
    policy_version?: number
    reason?: string
    grant_id?: string
    expires_at?: string
  }
  const intent = request?.intent ?? decision.intent ?? null
  const allow = decision.decision === 'ALLOW'
  const approval = decision.decision === 'REQUIRE_HUMAN_APPROVAL'
  const denied = decision.decision === 'DENY'

  const stages: PipelineStage[] = [
    { id: 'user', label: 'User', value: 'initiating user' },
    {
      id: 'agent',
      label: 'AI Agent',
      value: agent?.name ?? decision.agent_id?.slice(0, 8) ?? '—',
      detail: agent ? `Identity: ${agent.external_identity_id}` : undefined,
    },
    {
      id: 'intent',
      label: 'Intent',
      value: intent?.action ?? decision.action ?? '—',
      detail: [
        intent?.tool ? `tool: ${intent.tool}` : null,
        intent?.amount != null ? `amount: ₹${intent.amount.toLocaleString('en-IN')}` : null,
        intent?.risk_indicators?.length
          ? `indicators: ${intent.risk_indicators.join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: intent?.risk_indicators?.length ? 'deny' : 'neutral',
    },
    {
      id: 'policy',
      label: 'Policy Evaluation',
      value: `${meta.policy_key ?? decision.policy_key ?? '—'}${meta.policy_version ? ` v${meta.policy_version}` : ''}`,
      detail: `${decision.risk_score ?? '—'} risk · ${riskLevelOf(decision.risk_score)} — ${meta.reason ?? ''}`,
      tone: allow ? 'allow' : approval ? 'warn' : 'deny',
      blocked: denied,
    },
  ]

  if (denied) {
    stages.push({
      id: 'result',
      label: 'Result',
      value: 'DENY',
      detail: 'No JIT grant issued · action recorded in audit trail',
      tone: 'deny',
      blocked: true,
    })
    return stages
  }
  if (approval) {
    stages.push({
      id: 'approval',
      label: 'Human Approval',
      value: 'Requested',
      detail: 'Access only after explicit human approval',
      tone: 'warn',
      blocked: true,
    })
    return stages
  }

  const ttl = meta.expires_at
    ? Math.max(1, Math.round((new Date(meta.expires_at).getTime() - Date.now()) / 60_000))
    : null
  stages.push(
    {
      id: 'grant',
      label: 'JIT Access',
      value: meta.grant_id
        ? `Grant ${meta.grant_id.slice(0, 8)}… · ${ttl ?? '?'} min TTL`
        : 'grant issued',
      tone: 'info',
    },
    { id: 'tool', label: 'Tool / MCP', value: intent?.tool ?? decision.action ?? '—' },
    {
      id: 'result',
      label: 'Result',
      value: 'ALLOW',
      detail: 'Execution permitted within grant scope · audit trail recorded',
      tone: 'allow',
    },
  )
  return stages
}
