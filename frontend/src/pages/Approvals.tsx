import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Card, PageHeader, formatDateTime, shortId, timeAgo } from '../components/Card'
import { RiskBadge, StatusBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, TableSkeleton } from '../components/States'
import { useAgents, useApprovalResolution, useApprovals } from '../api/hooks'
import type { Approval } from '../api/types'

const DEMO_APPROVER = 'user-admin'

function amountOf(approval: Approval): string | null {
  const amount = (approval as unknown as { intent?: { amount?: number } }).intent?.amount
  return amount != null ? `₹${amount.toLocaleString('en-IN')}` : null
}

export function Approvals() {
  const pending = useApprovals('PENDING')
  const resolved = useApprovals()
  const agents = useAgents()
  const resolve = useApprovalResolution()

  const [lastResolved, setLastResolved] = useState<{ approval: Approval } | null>(null)
  const [reason, setReason] = useState('Reviewed in governance console')

  const agentName = (id: string | null) =>
    (agents.data ?? []).find((a) => a.agent_id === id)?.name ?? shortId(id, 8)

  const act = (approval: Approval, action: 'approve' | 'deny') => {
    resolve.mutate(
      { approvalId: approval.approval_id, action, approverId: DEMO_APPROVER, reason },
      { onSuccess: (updated) => setLastResolved({ approval: updated }) },
    )
  }

  const pendingList = pending.data ?? []
  const resolvedList = (resolved.data ?? []).filter((a) => a.status !== 'PENDING')

  return (
    <div>
      <PageHeader
        title="Human Approvals"
        subtitle="High-risk actions held for explicit human authorization"
      />

      <div className="mb-4 flex items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Resolution reason (applied to next approve/deny)"
          className="w-96 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
      </div>

      {resolve.isError && (
        <div className="mb-4 rounded-md border border-red-900/60 bg-red-950/30 px-4 py-2 text-xs text-red-300">
          Approval action failed:{' '}
          {resolve.error instanceof Error ? resolve.error.message : 'unknown error'}
        </div>
      )}

      {lastResolved && (
        <div
          className={`mb-6 rounded-lg border p-4 ${
            lastResolved.approval.status === 'APPROVED'
              ? 'border-emerald-500/40 bg-emerald-950/20'
              : 'border-red-500/40 bg-red-950/20'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {lastResolved.approval.status === 'APPROVED' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400" />
            )}
            <span className="text-slate-100">
              {lastResolved.approval.status} — {agentName(lastResolved.approval.agent_id)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">{lastResolved.approval.resolution_reason}</p>
          {lastResolved.approval.status === 'APPROVED' && (
            <p className="mt-1 text-xs text-sky-300">
              JIT grant issued — the authorized action can now execute. See the{' '}
              <Link
                to={`/agents/${lastResolved.approval.agent_id}`}
                className="underline hover:text-sky-200"
              >
                agent access tab
              </Link>{' '}
              or the audit trail.
            </p>
          )}
        </div>
      )}

      {pending.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-slate-800/60" />
          ))}
        </div>
      ) : pending.isError ? (
        <ErrorState error={pending.error} reset={() => void pending.refetch()} />
      ) : pendingList.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          hint="When policy requires human approval (e.g. high-value transfers), the request appears here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pendingList.map((approval) => (
            <ApprovalCard
              key={approval.approval_id}
              approval={approval}
              agentName={agentName(approval.agent_id)}
              onResolve={act}
              busy={resolve.isPending}
            />
          ))}
        </div>
      )}

      <ResolvedHistory list={resolvedList} loading={resolved.isLoading} agentName={agentName} />
    </div>
  )
}
function ApprovalCard({
  approval,
  agentName,
  onResolve,
  busy,
}: {
  approval: Approval
  agentName: string
  onResolve: (approval: Approval, action: 'approve' | 'deny') => void
  busy: boolean
}) {
  return (
    <div className="flex flex-col rounded-lg border border-amber-500/40 bg-slate-900/60 shadow-lg shadow-amber-950/20">
      <div className="border-b border-amber-500/30 px-4 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
          High Risk Action — Awaiting Approval
        </span>
      </div>
      <div className="flex-1 space-y-3 px-4 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-600">Agent</div>
          <div className="text-sm font-semibold text-slate-100">{agentName}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-600">Action</div>
            <div className="font-mono text-xs text-slate-300">{approval.action ?? '—'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-600">Tool</div>
            <div className="font-mono text-xs text-slate-300">{approval.tool ?? '—'}</div>
          </div>
        </div>
        {amountOf(approval) && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-600">Amount</div>
            <div className="text-sm font-semibold text-slate-100">{amountOf(approval)}</div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-slate-600">Risk Score</div>
          <RiskBadge score={approval.risk_score} />
        </div>
        <div className="rounded bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
          {approval.reason}
        </div>
        <div className="text-[11px] text-slate-600">
          Requested {timeAgo(approval.requested_at)} · expires {formatDateTime(approval.expires_at)}
        </div>
      </div>
      <div className="flex justify-between gap-2 border-t border-slate-800 px-4 py-3">
        <button
          onClick={() => onResolve(approval, 'deny')}
          disabled={busy}
          className="rounded-md border border-red-500/50 px-4 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        >
          DENY
        </button>
        <button
          onClick={() => onResolve(approval, 'approve')}
          disabled={busy}
          className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
        >
          APPROVE
        </button>
      </div>
    </div>
  )
}

function ResolvedHistory({
  list,
  loading,
  agentName,
}: {
  list: Approval[]
  loading: boolean
  agentName: (id: string | null) => string
}) {
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">Resolved</h2>
      {loading ? (
        <TableSkeleton cols={5} rows={2} />
      ) : list.length === 0 ? (
        <EmptyState title="No resolved approvals yet" />
      ) : (
        <Card>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-2 font-medium">Agent</th>
                <th className="px-2 py-2 font-medium">Action</th>
                <th className="px-2 py-2 font-medium">Risk</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Resolved By</th>
                <th className="px-2 py-2 font-medium">Resolution</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.approval_id} className="border-b border-slate-800/60">
                  <td className="px-2 py-2 text-slate-200">{agentName(a.agent_id)}</td>
                  <td className="px-2 py-2 font-mono text-[11px] text-slate-400">{a.action ?? '—'}</td>
                  <td className="px-2 py-2">
                    <RiskBadge score={a.risk_score} />
                  </td>
                  <td className="px-2 py-2">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-2 py-2 text-slate-400">{a.resolved_by ?? '—'}</td>
                  <td className="max-w-64 px-2 py-2 text-slate-500">
                    <span className="line-clamp-1">{a.resolution_reason ?? '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
