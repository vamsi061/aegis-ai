import { Link } from 'react-router-dom'
import { Card, shortId, timeAgo } from '../../components/Card'
import { SeverityBadge } from '../../components/StatusBadge'
import { EmptyState, TableSkeleton } from '../../components/States'
import type { SecurityAlert } from '../../api/types'

export function AlertsFeed({ alerts, loading }: { alerts: SecurityAlert[]; loading: boolean }) {
  return (
    <Card
      title="Recent Security Events"
      subtitle="Open alerts across all agents"
      actions={
        <Link to="/alerts" className="text-xs text-sky-400 hover:underline">
          View all
        </Link>
      }
    >
      {loading ? (
        <TableSkeleton rows={4} cols={2} />
      ) : alerts.length === 0 ? (
        <EmptyState title="No security events" hint="The environment is clean." />
      ) : (
        <ul className="space-y-2.5">
          {alerts.slice(0, 6).map((alert) => (
            <li key={alert.alert_id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <SeverityBadge severity={alert.severity} />
                <span className="text-[11px] text-slate-500">{timeAgo(alert.created_at)}</span>
              </div>
              <div className="mt-1.5 text-xs font-medium text-slate-200">
                {alert.alert_type.replaceAll('_', ' ')}
              </div>
              <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{alert.description}</div>
              <div className="mt-1.5 flex items-center gap-2">
                {alert.trace_id && (
                  <Link
                    to={`/audit/${alert.trace_id}`}
                    className="font-mono text-[11px] text-sky-400 hover:underline"
                  >
                    trace {shortId(alert.trace_id, 10)}
                  </Link>
                )}
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${
                    alert.status === 'OPEN'
                      ? 'bg-red-500/10 text-red-300 ring-red-500/40'
                      : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40'
                  }`}
                >
                  {alert.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
