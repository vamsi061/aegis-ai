
import { ArrowDown, ArrowRight, Ban, CheckCircle2 } from 'lucide-react'
import { Card, PageHeader, formatDateTime, shortId } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, TableSkeleton } from '../components/States'
import { useAgents, useDelegations } from '../api/hooks'

export function Delegations() {
  const delegations = useDelegations(false)
  const agents = useAgents()

  const agentName = (id: string) =>
    (agents.data ?? []).find((a) => a.agent_id === id)?.name ?? shortId(id, 8)

  const list = delegations.data ?? []

  return (
    <div>
      <PageHeader
        title="A2A Delegations"
        subtitle="Agent-to-agent delegation is confined to the intersection of source authority and target allowance"
      />

      {delegations.isError ? (
        <ErrorState error={delegations.error} reset={() => void delegations.refetch()} />
      ) : delegations.isLoading ? (
        <TableSkeleton rows={3} cols={5} />
      ) : list.length === 0 ? (
        <EmptyState
          title="No delegations recorded"
          hint="Use the Demo panel to create a valid delegation — or attempt a privilege escalation and watch it blocked."
        />
      ) : (
        <div className="space-y-4">
          {list.map((d) => {
            const denied = d.status !== 'ACTIVE'
            return (
              <Card key={d.delegation_id}>
                <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-center">
                  {/* Visual delegation chain */}
                  <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-950/40 p-5">
                    <Node label={agentName(d.source_agent_id)} sub="source agent" />
                    <ChainArrow denied={denied} label="requests delegation" />
                    <div
                      className={`mx-auto flex items-center gap-2 rounded-lg border px-4 py-2 ${
                        denied
                          ? 'border-red-500/50 bg-red-950/30'
                          : 'border-emerald-500/40 bg-emerald-950/30'
                      }`}
                    >
                      {denied ? (
                        <Ban className="h-4 w-4 text-red-400" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      )}
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        AEGIS
                      </span>
                      <span
                        className={`text-[11px] font-semibold uppercase ${
                          denied ? 'text-red-300' : 'text-emerald-300'
                        }`}
                      >
                        {denied ? 'DENIED — scope exceeds authority' : 'scope validated'}
                      </span>
                    </div>
                    {!denied && (
                      <>
                        <ChainArrow label="grants to" />
                        <Node label={agentName(d.target_agent_id)} sub="target agent" />
                        <ChainArrow label="may now invoke" />
                        <Node
                          label={(d.effective_scope.capabilities ?? []).join(', ') || '—'}
                          sub="effective scope"
                          mono
                        />
                      </>
                    )}
                  </div>

                  {/* Details */}
                  <div className="w-full space-y-2 text-xs lg:w-80">
                    <Row label="Delegation ID" value={shortId(d.delegation_id, 12)} mono />
                    <Row label="Source" value={agentName(d.source_agent_id)} />
                    <Row label="Target" value={agentName(d.target_agent_id)} />
                    <Row
                      label="Effective Scope"
                      value={(d.effective_scope.capabilities ?? []).join(', ') || '—'}
                    />
                    <Row label="Created" value={formatDateTime(d.expires_at)} />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-600">Status</span>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="pt-1">
                      <span className="font-mono text-[11px] text-sky-400">trace {shortId(d.trace_id, 10)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Node({ label, sub, mono }: { label: string; sub: string; mono?: boolean }) {
  return (
    <div className="w-48 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-center">
      <div className={`text-sm font-semibold text-slate-100 ${mono ? 'font-mono text-xs' : ''}`}>
        {label}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-slate-600">{sub}</div>
    </div>
  )
}

function ChainArrow({ label, denied }: { label: string; denied?: boolean }) {
  return (
    <div className="flex flex-col items-center py-0.5">
      {denied ? (
        <ArrowRight className="h-4 w-4 rotate-90 text-red-400" />
      ) : (
        <ArrowDown className="h-4 w-4 text-slate-600" />
      )}
      <span className="text-[10px] uppercase tracking-wider text-slate-600">{label}</span>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wider text-slate-600">{label}</span>
      <span className={`text-right text-slate-300 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</span>
    </div>
  )
}
