import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { PageHeader, formatDateTime, shortId, timeAgo } from '../components/Card'
import { SeverityBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, TableSkeleton } from '../components/States'
import { useAgents, useAlertResolution, useAlerts } from '../api/hooks'

export function Alerts() {
  const alerts = useAlerts()
  const agents = useAgents()
  const resolve = useAlertResolution()
  const [severityFilter, setSeverityFilter] = useState('')

  const agentName = (id: string | null) =>
    (agents.data ?? []).find((a) => a.agent_id === id)?.name ?? shortId(id, 8)

  const list = (alerts.data ?? [])
    .filter((a) => !severityFilter || a.severity === severityFilter)
    .sort((a, b) => {
      // Open alerts first, then by severity, then by recency.
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      if (a.status !== b.status) return a.status === 'OPEN' ? -1 : 1
      if (a.severity !== b.severity) return order[a.severity] - order[b.severity]
      return b.created_at.localeCompare(a.created_at)
    })

  return (
    <div>
      <PageHeader
        title="Security Alerts"
        subtitle="Raised automatically when policy blocks unauthorized or malicious behavior"
      />

      <div className="mb-4 flex gap-2">
        {['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              severityFilter === s
                ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/40'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {s === '' ? 'ALL' : s}
          </button>
        ))}
      </div>

      {alerts.isError ? (
        <ErrorState error={alerts.error} reset={() => void alerts.refetch()} />
      ) : alerts.isLoading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : list.length === 0 ? (
        <EmptyState title="No security alerts" hint="Blocked attempts and injection attempts appear here." />
      ) : (
        <div className="space-y-3">
          {list.map((alert) => (
            <div
              key={alert.alert_id}
              className={`rounded-lg border p-4 ${
                alert.status === 'OPEN'
                  ? 'border-red-900/60 bg-red-950/15'
                  : 'border-slate-800 bg-slate-900/40 opacity-75'
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <SeverityBadge severity={alert.severity} />
                <ShieldX
                  className={`h-4 w-4 ${alert.status === 'OPEN' ? 'text-red-400' : 'text-slate-600'}`}
                />
                <span className="text-sm font-semibold text-slate-100">
                  {alert.alert_type.replaceAll('_', ' ')}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${
                    alert.status === 'OPEN'
                      ? 'bg-red-500/10 text-red-300 ring-red-500/40'
                      : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40'
                  }`}
                >
                  {alert.status}
                </span>
                <span className="ml-auto text-[11px] text-slate-500">
                  {timeAgo(alert.created_at)}
                </span>
              </div>

              <div className="mt-3 grid gap-3 text-xs md:grid-cols-4">
                <Detail label="Agent" value={alert.agent_id ? agentName(alert.agent_id) : '—'} />
                <Detail label="Raised" value={formatDateTime(alert.created_at)} />
                <Detail label="Resolved" value={alert.resolved_at ? formatDateTime(alert.resolved_at) : '—'} />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-600">Trace</div>
                  {alert.trace_id ? (
                    <Link
                      to={`/audit/${alert.trace_id}`}
                      className="font-mono text-[11px] text-sky-400 hover:underline"
                    >
                      {shortId(alert.trace_id, 14)}
                    </Link>
                  ) : (
                    <span className='text-slate-400'>—</span>
                  )}
                </div>
              </div>

              <p className="mt-2 text-xs text-slate-400">{alert.description}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {alert.agent_id && (
                  <Link
                    to={`/agents/${alert.agent_id}`}
                    className="rounded border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                  >
                    View Agent
                  </Link>
                )}
                {alert.trace_id && (
                  <Link
                    to={`/audit/${alert.trace_id}`}
                    className="rounded border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                  >
                    View Trace
                  </Link>
                )}
                {alert.status === 'OPEN' && (
                  <button
                    onClick={() =>
                      resolve.mutate({ alertId: alert.alert_id, reason: 'Reviewed by administrator' })
                    }
                    disabled={resolve.isPending}
                    className="rounded border border-emerald-500/50 px-3 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-600">{label}</div>
      <div className="mt-0.5 text-slate-300">{value}</div>
    </div>
  )
}
