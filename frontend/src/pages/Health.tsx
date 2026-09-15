import { Card, PageHeader } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { useHealth, useReady } from '../api/hooks'

export function Health() {
  const health = useHealth()
  const ready = useReady()

  return (
    <div>
      <PageHeader title="System Health" subtitle="Aegis control plane service status" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="API Service">
          {health.isLoading ? (
            <div className="h-10 animate-pulse rounded bg-slate-800" />
          ) : health.isError ? (
            <p className="text-sm text-red-300">Unreachable — check FastAPI on localhost:8000.</p>
          ) : (
            <div className="space-y-2 text-xs">
              <Row label="Status" value={health.data?.status ?? '—'} />
              <Row label="Service" value={health.data?.service ?? '—'} />
              <Row label="Environment" value={health.data?.environment?.toUpperCase() ?? '—'} />
            </div>
          )}
        </Card>
        <Card title="Database">
          {ready.isLoading ? (
            <div className="h-10 animate-pulse rounded bg-slate-800" />
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">PostgreSQL</span>
                <StatusBadge status={ready.data?.ready ? 'ACTIVE' : 'EXPIRED'} />
              </div>
              <Row label="Connectivity" value={ready.data?.database ?? '—'} />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300">{value}</span>
    </div>
  )
}
