import { useMemo, useState } from 'react'
import { Card, PageHeader, shortId } from '../components/Card'
import { RiskBadge, StatusBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, TableSkeleton } from '../components/States'
import { useAgents, useMcpServers, useMcpTools } from '../api/hooks'

export function McpTools() {
  const servers = useMcpServers()
  const tools = useMcpTools()
  const agents = useAgents()
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

  const serverById = useMemo(
    () => new Map((servers.data ?? []).map((s) => [s.server_id, s])),
    [servers.data],
  )

  const authorizedAgents = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const tool of tools.data ?? []) {
      map.set(
        tool.name,
        (agents.data ?? [])
          .filter((a) => a.status === 'ACTIVE' && (a.capabilities ?? []).includes(tool.name))
          .map((a) => a.name),
      )
    }
    return map
  }, [tools.data, agents.data])

  const tool = (tools.data ?? []).find((t) => t.tool_id === selectedTool)

  return (
    <div>
      <PageHeader
        title="MCP & Tools"
        subtitle="Agents can never invoke tools directly — every call passes through the governed gateway"
      />

      <Card title="MCP Servers" className="mb-6">
        {servers.isLoading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : servers.isError ? (
          <ErrorState error={servers.error} reset={() => void servers.refetch()} />
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 font-medium">Server</th>
                <th className="px-3 py-2 font-medium">Endpoint</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Tools</th>
              </tr>
            </thead>
            <tbody>
              {(servers.data ?? []).map((s) => {
                const count = (tools.data ?? []).filter((t) => t.server_id === s.server_id).length
                return (
                  <tr key={s.server_id} className="border-b border-slate-800/60">
                    <td className="px-3 py-2.5 font-medium text-slate-200">{s.name}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{s.endpoint}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-400">{count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card title="Registered Tools" subtitle="Risk-classified tool registry" className="xl:col-span-3">
          {tools.isLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : tools.isError ? (
            <ErrorState error={tools.error} reset={() => void tools.refetch()} />
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-medium">Tool</th>
                  <th className="px-3 py-2 font-medium">MCP Server</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Authorized Agents</th>
                </tr>
              </thead>
              <tbody>
                {(tools.data ?? []).map((t) => (
                  <tr
                    key={t.tool_id}
                    onClick={() => setSelectedTool(t.tool_id)}
                    className={`cursor-pointer border-b border-slate-800/60 hover:bg-slate-800/40 ${
                      selectedTool === t.tool_id ? 'bg-emerald-500/5' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 font-mono text-[11px] font-medium text-slate-200">{t.name}</td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {serverById.get(t.server_id)?.name ?? shortId(t.server_id, 8)}
                    </td>
                    <td className="px-3 py-2.5"><RiskBadge level={t.risk_level} /></td>
                    <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {(authorizedAgents.get(t.name) ?? []).join(', ') || (
                        <span className="text-slate-600">none</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="xl:col-span-2">
          {tool ? (
            <Card title={tool.name} subtitle={tool.description ?? undefined}>
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-3">
                  <RiskBadge level={tool.risk_level} />
                  <StatusBadge status={tool.status} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-600">
                    Authorized agents (held capability)
                  </div>
                  <div className="mt-1 text-slate-300">
                    {(authorizedAgents.get(tool.name) ?? []).join(', ') || 'none'}
                  </div>
                </div>
                <div className="rounded-md border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/90">
                  Agents cannot invoke this tool directly. Execution requires an active JIT grant
                  issued by policy (or human approval), validated by the tool gateway on every call.
                </div>
              </div>
            </Card>
          ) : (
            <EmptyState
              title="Select a tool"
              hint="Tool details show risk classification and which agents may execute it."
            />
          )}
        </div>
      </div>
    </div>
  )
}
