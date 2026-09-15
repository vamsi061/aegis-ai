import { useState } from 'react'
import { Card, PageHeader, formatDateTime } from '../components/Card'
import { DecisionBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, TableSkeleton } from '../components/States'
import { usePolicies, usePolicy } from '../api/hooks'
import type { PolicySummary } from '../api/types'

export function Policies() {
  const policies = usePolicies()
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div>
      <PageHeader
        title="Policies"
        subtitle="Versioned policy-as-code evaluated deterministically on every request"
      />
      {policies.isError ? (
        <ErrorState error={policies.error} reset={() => void policies.refetch()} />
      ) : policies.isLoading ? (
        <TableSkeleton cols={6} rows={6} />
      ) : (policies.data ?? []).length === 0 ? (
        <EmptyState title="No policies registered" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-medium">Policy ID</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Version</th>
                    <th className="px-3 py-2 font-medium">Priority</th>
                    <th className="px-3 py-2 font-medium">Decision</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {(policies.data ?? []).map((p) => (
                    <PolicyRow
                      key={p.policy_key}
                      policy={p}
                      selected={selected === p.policy_key}
                      onSelect={() => setSelected(p.policy_key)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="xl:col-span-2">
            {selected ? (
              <PolicyDetailCard policyKey={selected} />
            ) : (
              <EmptyState
                title="Select a policy"
                hint="Policy details show the exact conditions the deterministic engine evaluates."
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PolicyRow({
  policy,
  selected,
  onSelect,
}: {
  policy: PolicySummary
  selected: boolean
  onSelect: () => void
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-slate-800/60 transition-colors hover:bg-slate-800/40 ${
        selected ? 'bg-emerald-500/5' : ''
      }`}
    >
      <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-slate-200">
        {policy.policy_key}
      </td>
      <td className="max-w-56 px-3 py-2.5 text-slate-300">{policy.name}</td>
      <td className="px-3 py-2.5 tabular-nums text-slate-400">v{policy.version}</td>
      <td className="px-3 py-2.5 tabular-nums text-slate-400">{policy.priority}</td>
      <td className="px-3 py-2.5">
        <DecisionBadge decision={policy.decision} size="sm" />
      </td>
      <td className="px-3 py-2.5">
        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300 ring-1 ring-emerald-500/40">
          {policy.status}
        </span>
      </td>
      <td className="px-3 py-2.5 text-slate-500">{formatDateTime(policy.updated_at)}</td>
    </tr>
  )
}
function PolicyDetailCard({ policyKey }: { policyKey: string }) {
  const detail = usePolicy(policyKey)
  if (detail.isLoading) return <TableSkeleton rows={4} cols={2} />
  if (detail.isError) return <ErrorState error={detail.error} />
  if (!detail.data) return <EmptyState title="Policy not found" />

  const p = detail.data
  const latest = p.versions.length > 0 ? p.versions[p.versions.length - 1] : null

  return (
    <Card title={`${p.policy_key} — ${p.name}`} subtitle={p.description ?? undefined}>
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <DecisionBadge decision={p.decision} />
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">v{p.version}</span>
          <span className="text-slate-500">priority {p.priority}</span>
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-300 ring-1 ring-emerald-500/40">
            {p.status}
          </span>
        </div>

        {latest && (
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Conditions (evaluated with AND)
            </div>
            <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
              {JSON.stringify(latest.conditions, null, 2)}
            </pre>
          </div>
        )}

        {p.versions.length > 1 && (
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Version History
            </div>
            <ul className="space-y-1">
              {p.versions.map((v) => (
                <li key={v.version} className="flex items-center gap-2 text-slate-400">
                  <span className="tabular-nums">v{v.version}</span>
                  <DecisionBadge decision={v.decision} size="sm" />
                  <span className="text-slate-600">{formatDateTime(v.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}
