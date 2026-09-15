import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/States'
import { Card, shortId } from '../components/Card'
import { GovernancePipeline } from '../components/GovernancePipeline'
import { KpiStrip, SecondaryMetrics } from './dashboard/KpiStrip'
import { ActivityChart, RiskChart } from './dashboard/Charts'
import { DecisionsTable } from './dashboard/DecisionsTable'
import { AlertsFeed } from './dashboard/AlertsFeed'
import {
  useAgents,
  useAlerts,
  useApprovals,
  useAuditEvents,
  useDelegations,
  useGrants,
} from '../api/hooks'
import {
  computeKpis,
  decisionActivity,
  pairDecisionEvents,
  pipelineFromEvents,
  riskDistribution,
  type DecisionEvent,
} from '../lib/dashboard'

export function Dashboard() {
  const agents = useAgents()
  const events = useAuditEvents({ limit: 500 })
  const alerts = useAlerts()
  const pending = useApprovals('PENDING')
  const delegations = useDelegations(false)
  const grants = useGrants(undefined, true)

  const [selected, setSelected] = useState<DecisionEvent | null>(null)

  const decisions = useMemo(
    () => (events.data ?? []).filter((e) => e.event_type === 'POLICY_DECISION'),
    [events.data],
  )
  const toolExecutions = useMemo(
    () => (events.data ?? []).filter((e) => e.event_type === 'TOOL_EXECUTION'),
    [events.data],
  )
  const pairs = useMemo(
    () => pairDecisionEvents(events.data ?? [], agents.data ?? []),
    [events.data, agents.data],
  )
  const kpis = useMemo(
    () =>
      computeKpis(
        agents.data ?? [],
        decisions,
        toolExecutions,
        pending.data ?? [],
        alerts.data ?? [],
        grants.data ?? [],
        delegations.data ?? [],
      ),
    [
      agents.data,
      decisions,
      toolExecutions,
      pending.data,
      alerts.data,
      grants.data,
      delegations.data,
    ],
  )
  const activity = useMemo(() => decisionActivity(decisions), [decisions])
  const risk = useMemo(() => riskDistribution(decisions), [decisions])

  const loading =
    agents.isLoading || events.isLoading || alerts.isLoading || pending.isLoading
  const fatal = agents.isError || events.isError

  return (
    <div className="space-y-6">
      <PageHeader
        title="Governance Overview"
        subtitle="Every sensitive agent action passes through this control plane"
      />

      {fatal ? (
        <Card title="Backend error">
          <p className="text-sm text-red-300">
            Failed to load core governance data:{' '}
            {agents.error instanceof Error ? agents.error.message : 'unknown error'}
          </p>
        </Card>
      ) : (
        <>
          <KpiStrip kpis={kpis} loading={loading} />
          {!loading && kpis && <SecondaryMetrics kpis={kpis} />}

          <Card
            title="Governance Pipeline"
            subtitle={
              selected
                ? `Live decision path — trace ${shortId(selected.decision.trace_id, 14)}`
                : 'Select a governance decision below to see how Aegis evaluated it'
            }
            actions={
              selected ? (
                <Link
                  to={`/audit/${selected.decision.trace_id}`}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Open full trace →
                </Link>
              ) : undefined
            }
          >
            <GovernancePipeline stages={selected ? pipelineFromEvents(selected) : []} />
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            <ActivityChart data={activity} />
            <RiskChart data={risk} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <DecisionsTable
              pairs={pairs}
              loading={events.isLoading}
              selectedId={selected?.decision.event_id}
              onSelect={setSelected}
            />
            <AlertsFeed alerts={alerts.data ?? []} loading={alerts.isLoading} />
          </div>
        </>
      )}
    </div>
  )
}
