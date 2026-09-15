import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Bot } from 'lucide-react'
import { Card, PageHeader, shortId, timeAgo } from '../components/Card'
import { RiskBadge, StatusBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, TableSkeleton } from '../components/States'
import { useAgentLifecycle, useAgents } from '../api/hooks'
import type { Agent } from '../api/types'

type StatusFilter = '' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED'
type RiskFilter = '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

const selectCls =
  'rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'

export function Agents() {
  const agents = useAgents()
  const lifecycle = useAgentLifecycle()

  const [status, setStatus] = useState<StatusFilter>('')
  const [risk, setRisk] = useState<RiskFilter>('')
  const [environment, setEnvironment] = useState('')
  const [owner, setOwner] = useState('')

  const environments = useMemo(
    () => [...new Set((agents.data ?? []).map((a) => a.environment))],
    [agents.data],
  )
  const owners = useMemo(
    () => [...new Set((agents.data ?? []).map((a) => a.owner_user_id))],
    [agents.data],
  )

  const filtered = useMemo(
    () =>
      (agents.data ?? []).filter(
        (a) =>
          (!status || a.status === status) &&
          (!risk || a.risk_level === risk) &&
          (!environment || a.environment === environment) &&
          (!owner || a.owner_user_id === owner),
      ),
    [agents.data, status, risk, environment, owner],
  )

  const lifecycleButton = (
    agent: Agent,
    action: 'activate' | 'suspend' | 'retire',
    label: string,
    visibleWhen: string[],
  ) =>
    visibleWhen.includes(agent.status) && (
      <button
        onClick={() => lifecycle.mutate({ agentId: agent.agent_id, action })}
        disabled={lifecycle.isPending}
        className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
      >
        {label}
      </button>
    )

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Registered AI agents with enterprise identity, owner and declared purpose"
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Bot className="h-4 w-4" />
            {(agents.data ?? []).length} registered
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="">All statuses</option>
          {['ACTIVE', 'PENDING', 'SUSPENDED', 'RETIRED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={selectCls} value={risk} onChange={(e) => setRisk(e.target.value as RiskFilter)}>
          <option value="">All risk levels</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select className={selectCls} value={environment} onChange={(e) => setEnvironment(e.target.value)}>
          <option value="">All environments</option>
          {environments.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </select>
        <select className={selectCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {agents.isError ? (
        <ErrorState error={agents.error} reset={() => void agents.refetch()} />
      ) : agents.isLoading ? (
        <TableSkeleton cols={7} rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No agents match the current filters" />
      ) : (
        <Card>
          <AgentTable agents={filtered} lifecycle={lifecycle} lifecycleButton={lifecycleButton} />
        </Card>
      )}

      {lifecycle.isError && (
        <p className="mt-3 text-xs text-red-400">
          Lifecycle action failed:{' '}
          {lifecycle.error instanceof Error ? lifecycle.error.message : 'unknown error'}
        </p>
      )}
    </div>
  )
}
function AgentTable({
  agents,
  lifecycle,
  lifecycleButton,
}: {
  agents: Agent[]
  lifecycle: { isPending: boolean }
  lifecycleButton: (
    agent: Agent,
    action: 'activate' | 'suspend' | 'retire',
    label: string,
    visibleWhen: string[],
  ) => ReactNode
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2 font-medium">Agent</th>
            <th className="px-3 py-2 font-medium">Identity</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Purpose</th>
            <th className="px-3 py-2 font-medium">Risk</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Capabilities</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.agent_id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
              <td className="px-3 py-3">
                <Link
                  to={`/agents/${agent.agent_id}`}
                  className="font-medium text-slate-100 hover:text-emerald-300"
                >
                  {agent.name}
                </Link>
                <div className="text-[10px] text-slate-600">{timeAgo(agent.created_at)}</div>
              </td>
              <td className="px-3 py-3 font-mono text-[11px] text-slate-500">
                {shortId(agent.external_identity_id, 18)}
              </td>
              <td className="px-3 py-3 text-slate-300">{agent.owner_user_id}</td>
              <td className="max-w-44 px-3 py-3 text-slate-400">{agent.purpose}</td>
              <td className="px-3 py-3">
                <RiskBadge level={agent.risk_level} />
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={agent.status} />
              </td>
              <td className="px-3 py-3">
                <div className="flex max-w-56 flex-wrap gap-1">
                  {(agent.capabilities ?? []).map((cap) => (
                    <span
                      key={cap}
                      className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="flex gap-1.5">
                  <Link
                    to={`/agents/${agent.agent_id}`}
                    className="rounded border border-emerald-500/40 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
                  >
                    View
                  </Link>
                  {lifecycleButton(agent, 'activate', 'Activate', ['PENDING', 'SUSPENDED'])}
                  {lifecycleButton(agent, 'suspend', 'Suspend', ['ACTIVE'])}
                  {lifecycleButton(agent, 'retire', 'Retire', ['ACTIVE', 'SUSPENDED', 'PENDING'])}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {lifecycle.isPending && <div className="px-3 py-2 text-[11px] text-slate-500">Applying lifecycle action…</div>}
    </div>
  )
}
