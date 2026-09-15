import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, formatDateTime, shortId, timeAgo } from '../components/Card'
import { DecisionBadge, RiskBadge, StatusBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, TableSkeleton } from '../components/States'
import { useAgent, useAuditEvents, useDelegations, useGrants, useMcpTools } from '../api/hooks'
import type { Agent } from '../api/types'

const TABS = ['Overview', 'Capabilities', 'Activity', 'Access', 'Delegations', 'Risk', 'Lifecycle'] as const
type Tab = (typeof TABS)[number]

export function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>()
  const agent = useAgent(agentId)
  const grants = useGrants(agentId)
  const events = useAuditEvents({ agent_id: agentId, limit: 200 })
  const delegations = useDelegations(false)
  const tools = useMcpTools()

  const [tab, setTab] = useState<Tab>('Overview')

  const agentEvents = events.data ?? []
  // The API may return null for optional list fields; normalise once here so
  // every tab below can treat them as arrays.
  const capabilities = agent?.data?.capabilities ?? []
  const dataScopes = agent?.data?.data_scope ?? []
  const decisions = useMemo(
    () => agentEvents.filter((e) => e.event_type === 'POLICY_DECISION').reverse(),
    [agentEvents],
  )
  const lifecycleEvents = useMemo(
    () =>
      agentEvents
        .filter((e) => e.event_type === 'AGENT_LIFECYCLE')
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [agentEvents],
  )
  const relatedDelegations = useMemo(
    () =>
      (delegations.data ?? []).filter(
        (d) => d.source_agent_id === agentId || d.target_agent_id === agentId,
      ),
    [delegations.data, agentId],
  )
  const riskCounts = useMemo(() => {
    const counts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    for (const e of decisions) counts[riskBucket(e.risk_score)] += 1
    return counts
  }, [decisions])

  if (agent.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-800" />
        <div className="h-24 animate-pulse rounded-lg bg-slate-800/60" />
        <TableSkeleton rows={4} />
      </div>
    )
  }
  if (agent.isError) {
    return <ErrorState error={agent.error} reset={() => void agent.refetch()} />
  }
  if (!agent.data) {
    return <EmptyState title="Agent not found" hint="It may have been removed from the registry." />
  }

  const a: Agent = agent.data

  return (
    <div>
      <Link to="/agents" className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
        <ArrowLeft className="h-3 w-3" /> All agents
      </Link>

      {/* Header */}
      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-100">{a.name}</h1>
          <StatusBadge status={a.status} />
          <RiskBadge level={a.risk_level} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-xs lg:grid-cols-4">
          <Field label="Agent ID" value={shortId(a.agent_id, 18)} mono />
          <Field label="Enterprise Identity" value={a.external_identity_id ?? '—'} mono />
          <Field label="Owner" value={a.owner_user_id} />
          <Field label="Environment" value={a.environment?.toUpperCase() ?? '—'} />
          <Field label="Purpose" value={a.purpose} wide />
          <Field label="Created" value={formatDateTime(a.created_at)} />
          <Field label="Last Updated" value={formatDateTime(a.updated_at)} />
        </dl>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-emerald-400 text-emerald-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab decisions={decisions.length} activeGrants={grants.data ?? []} dataScopes={dataScopes} />}
      {tab === 'Capabilities' && <CapabilitiesTab tools={tools.data ?? []} capabilities={capabilities} />}
      {tab === 'Activity' && <ActivityTab events={agentEvents} loading={events.isLoading} />}
      {tab === 'Access' && <AccessTab grants={grants.data ?? []} loading={grants.isLoading} />}
      {tab === 'Delegations' && <DelegationsTab delegations={relatedDelegations} />}
      {tab === 'Risk' && <RiskTab counts={riskCounts} decisions={decisions.slice(0, 10)} />}
      {tab === 'Lifecycle' && <LifecycleTab events={lifecycleEvents} a={a} />}
    </div>
  )
}

function riskBucket(score: number | null): string {
  if (score == null) return 'LOW'
  if (score >= 75) return 'CRITICAL'
  if (score >= 50) return 'HIGH'
  if (score >= 25) return 'MEDIUM'
  return 'LOW'
}

function Field({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-[10px] uppercase tracking-wider text-slate-600">{label}</dt>
      <dd className={`mt-0.5 text-slate-300 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</dd>
    </div>
  )
}
import { CheckCircle2, MinusCircle } from 'lucide-react'
import type { AccessGrant, AuditEvent, McpTool } from '../api/types'
import type { Delegation } from '../api/types'

function OverviewTab({
  decisions,
  activeGrants,
  dataScopes,
}: {
  decisions: number
  activeGrants: AccessGrant[]
  dataScopes: string[]
}) {
  const active = activeGrants.filter((g) => g.status === 'ACTIVE').length
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card title="Authorization Activity">
        <div className="text-2xl font-semibold text-slate-100">{decisions}</div>
        <div className="text-xs text-slate-500">policy decisions recorded</div>
      </Card>
      <Card title="Active JIT Grants">
        <div className="text-2xl font-semibold text-sky-300">{active}</div>
        <div className="text-xs text-slate-500">task-scoped, time-bound grants</div>
      </Card>
      <Card title="Data Scope">
        <div className="flex flex-wrap gap-1.5">
          {dataScopes.length === 0 ? (
            <span className="text-xs text-slate-500">No data scopes declared</span>
          ) : (
            dataScopes.map((s) => (
              <span key={s} className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                {s}
              </span>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

function CapabilitiesTab({
  tools,
  capabilities,
}: {
  tools: McpTool[]
  capabilities: string[]
}) {
  // Governed view: capabilities the agent holds vs. sensitive tools it may
  // NOT invoke. Derived from real registry data, not invented.
  const sensitiveTools = tools.filter(
    (t) => t.risk_level === 'HIGH' || t.risk_level === 'CRITICAL',
  )
  const blocked = sensitiveTools.filter((t) => !capabilities.includes(t.name))
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Allowed Capabilities" subtitle="Declared within the agent's purpose">
        <ul className="space-y-2">
          {capabilities.map((cap) => (
            <li key={cap} className="flex items-center justify-between rounded border border-emerald-900/50 bg-emerald-950/20 px-3 py-2">
              <span className="font-mono text-xs text-slate-200">{cap}</span>
              <span className="flex items-center gap-1 text-[11px] font-semibold uppercase text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Allowed
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Blocked Sensitive Tools" subtitle="High/critical-risk tools outside this agent's capabilities">
        {blocked.length === 0 ? (
          <EmptyState title="No blocked sensitive tools" />
        ) : (
          <ul className="space-y-2">
            {blocked.map((t) => (
              <li key={t.tool_id} className="flex items-center justify-between rounded border border-red-900/50 bg-red-950/20 px-3 py-2">
                <span className="font-mono text-xs text-slate-200">{t.name}</span>
                <span className="flex items-center gap-2">
                  <RiskBadge level={t.risk_level} />
                  <span className="flex items-center gap-1 text-[11px] font-semibold uppercase text-red-300">
                    <MinusCircle className="h-3.5 w-3.5" /> Blocked
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function ActivityTab({ events, loading }: { events: AuditEvent[]; loading: boolean }) {
  if (loading) return <TableSkeleton cols={5} />
  const relevant = events.filter((e) =>
    ['POLICY_DECISION', 'TOOL_EXECUTION', 'GRANT_CREATED'].includes(e.event_type),
  )
  if (relevant.length === 0) return <EmptyState title="No recent activity" />
  return (
    <Card>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-2 py-2 font-medium">Time</th>
            <th className="px-2 py-2 font-medium">Event</th>
            <th className="px-2 py-2 font-medium">Action</th>
            <th className="px-2 py-2 font-medium">Decision</th>
            <th className="px-2 py-2 font-medium">Trace</th>
          </tr>
        </thead>
        <tbody>
          {relevant.slice(0, 15).map((e) => (
            <tr key={e.event_id} className="border-b border-slate-800/60">
              <td className="px-2 py-2 text-slate-400">{timeAgo(e.timestamp)}</td>
              <td className="px-2 py-2 text-slate-300">{e.event_type.replaceAll('_', ' ')}</td>
              <td className="px-2 py-2 font-mono text-[11px] text-slate-400">{e.action ?? '—'}</td>
              <td className="px-2 py-2">
                <DecisionBadge decision={e.decision} size="sm" />
              </td>
              <td className="px-2 py-2">
                <Link to={`/audit/${e.trace_id}`} className="font-mono text-[11px] text-sky-400 hover:underline">
                  {shortId(e.trace_id, 10)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function AccessTab({ grants, loading }: { grants: AccessGrant[]; loading: boolean }) {
  if (loading) return <TableSkeleton cols={5} />
  if (grants.length === 0)
    return <EmptyState title="No JIT grants" hint="Grants appear when authorization allows a tool call." />
  return (
    <Card>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-2 py-2 font-medium">Grant ID</th>
            <th className="px-2 py-2 font-medium">Tool</th>
            <th className="px-2 py-2 font-medium">Scope</th>
            <th className="px-2 py-2 font-medium">Issued</th>
            <th className="px-2 py-2 font-medium">Expires</th>
            <th className="px-2 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {grants.map((g) => (
            <tr key={g.grant_id} className="border-b border-slate-800/60">
              <td className="px-2 py-2 font-mono text-[11px] text-slate-400">{shortId(g.grant_id, 10)}</td>
              <td className="px-2 py-2 font-mono text-[11px] text-slate-300">{g.tool_name ?? '—'}</td>
              <td className="max-w-52 px-2 py-2">
                <span className="line-clamp-1 font-mono text-[11px] text-slate-500">
                  {JSON.stringify(g.scope)}
                </span>
              </td>
              <td className="px-2 py-2 text-slate-400">{formatDateTime(g.issued_at)}</td>
              <td className="px-2 py-2 text-slate-400">{formatDateTime(g.expires_at)}</td>
              <td className="px-2 py-2">
                <StatusBadge status={g.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function DelegationsTab({ delegations }: { delegations: Delegation[] }) {
  if (delegations.length === 0)
    return <EmptyState title="No delegations" hint="A2A delegations involving this agent appear here." />
  return (
    <Card>
      <ul className="space-y-2">
        {delegations.map((d) => (
          <li key={d.delegation_id} className="rounded border border-slate-800 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">
                {shortId(d.source_agent_id, 8)} → {shortId(d.target_agent_id, 8)}
              </span>
              <StatusBadge status={d.status} />
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Effective scope: {(d.effective_scope.capabilities ?? []).join(', ') || '—'} · expires{' '}
              {formatDateTime(d.expires_at)}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function RiskTab({
  counts,
  decisions,
}: {
  counts: Record<string, number>
  decisions: AuditEvent[]
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((level) => (
          <div key={level} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-center">
            <RiskBadge level={level} />
            <div className="mt-2 text-xl font-semibold tabular-nums text-slate-100">{counts[level]}</div>
          </div>
        ))}
      </div>
      <Card title="Recent decision risk">
        {decisions.length === 0 ? (
          <EmptyState title="No decisions yet" />
        ) : (
          <ul className="space-y-1.5">
            {decisions.map((d) => (
              <li key={d.event_id} className="flex items-center justify-between rounded border border-slate-800/60 px-3 py-2 text-xs">
                <span className="font-mono text-[11px] text-slate-400">
                  {(d.metadata as { policy_key?: string }).policy_key ?? '—'}
                </span>
                <span className="text-slate-400">{timeAgo(d.timestamp)}</span>
                <RiskBadge score={d.risk_score} />
                <DecisionBadge decision={d.decision} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function LifecycleTab({
  events,
  a,
}: {
  events: AuditEvent[]
  a: Agent
}) {
  const steps = events.length > 0 ? events : []
  return (
    <Card title="Lifecycle Timeline" subtitle="From registration to current state">
      <ol className="relative ml-3 border-l border-slate-800">
        {steps.map((e) => (
          <li key={e.event_id} className="mb-6 ml-6">
            <span className="absolute -left-1.5 flex h-3 w-3 rounded-full bg-emerald-400 ring-4 ring-slate-950" />
            <div className="text-xs font-medium text-slate-200">{e.action ?? e.event_type}</div>
            <div className="text-[11px] text-slate-500">
              {formatDateTime(e.timestamp)} · {e.status ?? ''}
            </div>
          </li>
        ))}
        <li className="ml-6">
          <span className="absolute -left-1.5 flex h-3 w-3 rounded-full bg-slate-600 ring-4 ring-slate-950" />
          <div className="text-xs text-slate-400">Current state: {a.status}</div>
        </li>
      </ol>
      {steps.length === 0 && (
        <p className="mt-2 text-[11px] text-slate-600">
          No lifecycle events recorded yet in the audit trail.
        </p>
      )}
    </Card>
  )
}
