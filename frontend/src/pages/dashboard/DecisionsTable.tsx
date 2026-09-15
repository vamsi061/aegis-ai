import { Link } from 'react-router-dom'
import { Card, formatTime, shortId } from '../../components/Card'
import { DecisionBadge, RiskBadge } from '../../components/StatusBadge'
import { EmptyState, TableSkeleton } from '../../components/States'
import type { DecisionEvent } from '../../lib/dashboard'

export function DecisionsTable({
  pairs,
  loading,
  selectedId,
  onSelect,
}: {
  pairs: DecisionEvent[]
  loading: boolean
  selectedId?: string
  onSelect: (pair: DecisionEvent) => void
}) {

  return (
    <Card
      title="Recent Governance Decisions"
      subtitle="Click a row to inspect the pipeline above"
      className="xl:col-span-2"
    >
      {loading ? (
        <TableSkeleton cols={7} />
      ) : pairs.length === 0 ? (
        <EmptyState title="No decisions recorded yet" hint="Authorization decisions will appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-2 font-medium">Time</th>
                <th className="px-2 py-2 font-medium">Agent</th>
                <th className="px-2 py-2 font-medium">Intent</th>
                <th className="px-2 py-2 font-medium">Decision</th>
                <th className="px-2 py-2 font-medium">Risk</th>
                <th className="px-2 py-2 font-medium">Policy</th>
                <th className="px-2 py-2 font-medium">Trace</th>
              </tr>
            </thead>
            <tbody>
              {pairs.slice(0, 12).map((pair) => (
                <tr
                  key={pair.decision.event_id}
                  onClick={() => onSelect(pair)}
                  className={`cursor-pointer border-b border-slate-800/60 transition-colors hover:bg-slate-800/40 ${
                    selectedId === pair.decision.event_id ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <td className="px-2 py-2.5 tabular-nums text-slate-400">
                    {formatTime(pair.decision.timestamp)}
                  </td>
                  <td className="px-2 py-2.5 font-medium text-slate-200">
                    {pair.agent?.name ?? shortId(pair.decision.agent_id)}
                  </td>
                  <td className="px-2 py-2.5 text-slate-300">
                    {pair.request?.intent?.action ?? pair.decision.action ?? '—'}
                  </td>
                  <td className="px-2 py-2.5">
                    <DecisionBadge decision={pair.decision.decision} size="sm" />
                  </td>
                  <td className="px-2 py-2.5">
                    <RiskBadge score={pair.decision.risk_score} />
                  </td>
                  <td className="px-2 py-2.5 font-mono text-[11px] text-slate-400">
                    {(pair.decision.metadata as { policy_key?: string }).policy_key ?? '—'}
                  </td>
                  <td className="px-2 py-2.5">
                    <Link
                      to={`/audit/${pair.decision.trace_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-[11px] text-sky-400 hover:underline"
                    >
                      {shortId(pair.decision.trace_id, 10)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
