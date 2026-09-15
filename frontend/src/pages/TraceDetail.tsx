import { Link, useParams } from 'react-router-dom'
import { ArrowDown } from 'lucide-react'
import { Card, PageHeader, formatDateTime, shortId } from '../components/Card'
import { DecisionBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState } from '../components/States'
import { useAgents, useTrace } from '../api/hooks'

const EVENT_TONES: Record<string, 'neutral' | 'allow' | 'deny' | 'warn' | 'info'> = {
  AUTHORIZATION_REQUESTED: 'neutral',
  POLICY_DECISION: 'warn',
  GRANT_CREATED: 'info',
  TOOL_EXECUTION: 'allow',
  DELEGATION_REQUESTED: 'neutral',
  DELEGATION_GRANTED: 'allow',
  DELEGATION_DENIED: 'deny',
  APPROVAL_REQUESTED: 'warn',
  APPROVAL_RESOLVED: 'allow',
}

export function TraceDetail() {
  const { traceId } = useParams<{ traceId: string }>()
  const trace = useTrace(traceId)
  const agents = useAgents()

  if (trace.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-800/60" />
        ))}
      </div>
    )
  }
  if (trace.isError) return <ErrorState error={trace.error} reset={() => void trace.refetch()} />
  if (!trace.data || trace.data.steps.length === 0)
    return <EmptyState title="Trace not found" hint={`No events recorded for ${traceId ?? ''}`} />

  const data = trace.data
  const agentName = (id: string | null) =>
    (agents.data ?? []).find((a) => a.agent_id === id)?.name ?? shortId(id, 8)

  return (
    <div>
      <Link to="/audit" className="mb-4 inline-block text-xs text-slate-500 hover:text-slate-300">
        ← All audit events
      </Link>
      <PageHeader
        title={`Trace ${data.trace_id}`}
        subtitle={`${data.steps.length} events · ${data.grants.length} JIT grants · ${data.delegations.length} delegations`}
      />

      {/* Vertical execution chain */}
      <div className="mx-auto max-w-2xl py-2">
        {data.steps.map((step, i) => {
          const tone = EVENT_TONES[step.event_type] ?? 'neutral'
          const toneCls = {
            neutral: 'border-slate-700 bg-slate-900/60',
            allow: 'border-emerald-500/40 bg-emerald-950/20',
            deny: 'border-red-500/50 bg-red-950/20',
            warn: 'border-amber-500/40 bg-amber-950/20',
            info: 'border-sky-500/40 bg-sky-950/20',
          }[tone]
          return (
            <div key={step.event_id} className="animate-fade-up">
              <div className={`rounded-lg border p-4 ${toneCls}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    {step.seq}. {step.event_type.replaceAll('_', ' ')}
                  </span>
                  <span className="text-[10px] tabular-nums text-slate-600">
                    {formatDateTime(step.timestamp)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {step.agent_id && (
                    <span className="text-sm font-semibold text-slate-100">
                      {agentName(step.agent_id)}
                    </span>
                  )}
                  {step.action && (
                    <span className="font-mono text-xs text-slate-300">{step.action}</span>
                  )}
                  {step.decision && <DecisionBadge decision={step.decision} size="sm" />}
                </div>
                {Object.keys(step.detail).length > 0 && (
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-950/70 p-2.5 font-mono text-[11px] leading-relaxed text-slate-400">
                    {JSON.stringify(step.detail, null, 2)}
                  </pre>
                )}
              </div>
              {i < data.steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="h-4 w-4 text-slate-600" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Grants & delegations issued within this trace */}
      {(data.grants.length > 0 || data.delegations.length > 0) && (
        <div className="mx-auto mt-6 grid max-w-4xl gap-4 md:grid-cols-2">
          {data.grants.length > 0 && (
            <Card title="JIT Grants in this trace">
              <ul className="space-y-2 text-xs">
                {data.grants.map((g) => (
                  <li key={g.grant_id} className="rounded border border-slate-800 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-300">{shortId(g.grant_id, 12)}</span>
                      <StatusChip status={g.status} />
                    </div>
                    <div className="mt-1 text-slate-500">
                      tool: <span className="font-mono">{g.tool ?? '—'}</span> · expires{' '}
                      {formatDateTime(g.expires_at)}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {data.delegations.length > 0 && (
            <Card title="Delegations in this trace">
              <ul className="space-y-2 text-xs">
                {data.delegations.map((d) => (
                  <li key={d.delegation_id} className="rounded border border-slate-800 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">
                        {agentName(d.source_agent_id)} → {agentName(d.target_agent_id)}
                      </span>
                      <StatusChip status={d.status} />
                    </div>
                    <div className="mt-1 text-slate-500">
                      scope: {(d.effective_scope.capabilities ?? []).join(', ') || '—'}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === 'ACTIVE' || status === 'APPROVED'
      ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40'
      : status === 'EXPIRED' || status === 'REVOKED'
        ? 'bg-slate-500/10 text-slate-400 ring-slate-500/40'
        : 'bg-red-500/10 text-red-300 ring-red-500/40'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${cls}`}>
      {status}
    </span>
  )
}
