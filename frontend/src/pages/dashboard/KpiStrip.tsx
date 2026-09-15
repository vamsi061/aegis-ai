import { KpiCard } from '../../components/Card'
import type { Kpis } from '../../lib/dashboard'

export function KpiStrip({ kpis, loading }: { kpis: Kpis | null; loading: boolean }) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-800/60" />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <KpiCard label="Active Agents" value={kpis.activeAgents} hint={`${kpis.totalAgents} registered`} />
      <KpiCard label="Authorization Requests" value={kpis.authRequests} />
      <KpiCard label="Allowed" value={kpis.allowed} tone="allow" />
      <KpiCard label="Denied" value={kpis.denied} tone="deny" />
      <KpiCard
        label="Pending Approvals"
        value={kpis.pendingApprovals}
        tone={kpis.pendingApprovals > 0 ? 'warn' : 'default'}
      />
      <KpiCard
        label="Security Alerts"
        value={kpis.openAlerts}
        tone={kpis.openAlerts > 0 ? 'deny' : 'default'}
        hint="open"
      />
    </div>
  )
}

export function SecondaryMetrics({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <KpiCard label="JIT Grants Active" value={kpis.activeGrants} tone="info" />
      <KpiCard label="Active Delegations" value={kpis.activeDelegations} tone="info" />
      <KpiCard label="Tool Invocations" value={kpis.toolInvocations} />
      <KpiCard
        label="Avg Decision Latency"
        value={kpis.avgLatencyMs != null ? `${kpis.avgLatencyMs} ms` : '—'}
      />
      <KpiCard label="Token Usage" value={kpis.tokenUsage.toLocaleString()} />
      <KpiCard label="Estimated Cost" value={`$${kpis.estimatedCost.toFixed(4)}`} />
    </div>
  )
}
