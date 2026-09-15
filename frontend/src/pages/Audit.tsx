import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, PageHeader, formatDateTime, shortId } from '../components/Card'
import { DecisionBadge, RiskBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, TableSkeleton } from '../components/States'
import { useAgents, useAuditEvents } from '../api/hooks'

const selectCls =
  'rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'

export function Audit() {
  const navigate = useNavigate()
  const agents = useAgents()

  const [traceFilter, setTraceFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [decisionFilter, setDecisionFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // All filters are server-side query params — changing them refetches.
  const events = useAuditEvents({
    trace_id: traceFilter || undefined,
    agent_id: agentFilter || undefined,
    decision: decisionFilter || undefined,
    event_type: typeFilter || undefined,
    limit: 300,
  })

  return (
    <div>
      <PageHeader
        title="Audit & Lineage"
        subtitle="Append-only record of every governance decision and execution"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={traceFilter}
          onChange={(e) => setTraceFilter(e.target.value)}
          placeholder="Search by trace ID…"
          className={selectCls + ' w-64'}
        />
        <select className={selectCls} value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
          <option value="">All agents</option>
          {(agents.data ?? []).map((a) => (
            <option key={a.agent_id} value={a.agent_id}>
              {a.name}
            </option>
          ))}
        </select>
        <select className={selectCls} value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)}>
          <option value="">All decisions</option>
          {['ALLOW', 'DENY', 'REQUIRE_HUMAN_APPROVAL', 'RATE_LIMIT'].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select className={selectCls} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All event types</option>
          {[
            'AUTHORIZATION_REQUESTED',
            'POLICY_DECISION',
            'GRANT_CREATED',
            'TOOL_EXECUTION',
            'APPROVAL_REQUESTED',
            'APPROVAL_RESOLVED',
            'DELEGATION_REQUESTED',
            'DELEGATION_GRANTED',
            'DELEGATION_DENIED',
            'AGENT_LIFECYCLE',
            'SECURITY_ALERT',
          ].map((t) => (
            <option key={t} value={t}>
              {t.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {events.isError ? (
        <ErrorState error={events.error} reset={() => void events.refetch()} />
      ) : events.isLoading ? (
        <TableSkeleton cols={7} rows={8} />
      ) : (events.data ?? []).length === 0 ? (
        <EmptyState title="No matching audit events" hint="Adjust the filters or run a demo scenario." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-medium">Timestamp</th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Event Type</th>
                  <th className="px-3 py-2 font-medium">Intent / Action</th>
                  <th className="px-3 py-2 font-medium">Decision</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                  <th className="px-3 py-2 font-medium">Policy</th>
                  <th className="px-3 py-2 font-medium">Trace</th>
                </tr>
              </thead>
              <tbody>
                {(events.data ?? []).map((e) => {
                  const agent = (agents.data ?? []).find((a) => a.agent_id === e.agent_id)
                  return (
                    <tr
                      key={e.event_id}
                      onClick={() => navigate(`/audit/${e.trace_id}`)}
                      className="cursor-pointer border-b border-slate-800/60 hover:bg-slate-800/40"
                    >
                      <td className="px-3 py-2.5 tabular-nums text-slate-400">
                        {formatDateTime(e.timestamp)}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-200">
                        {agent?.name ?? (e.agent_id ? shortId(e.agent_id, 8) : '—')}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {e.event_type.replaceAll('_', ' ')}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                        {e.intent?.action ?? e.action ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <DecisionBadge decision={e.decision} size="sm" />
                      </td>
                      <td className="px-3 py-2.5">
                        <RiskBadge score={e.risk_score} />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">
                        {e.policy_key ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-sky-400">
                        {shortId(e.trace_id, 10)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
