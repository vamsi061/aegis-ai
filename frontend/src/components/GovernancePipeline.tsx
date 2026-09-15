/**
 * Hero governance visualization (§7): the USER → AGENT → INTENT → POLICY →
 * JIT ACCESS → TOOL → RESOURCE → RESULT pipeline, populated with real event
 * data. For denied requests the chain terminates at POLICY with BLOCKED.
 *
 * PipelineStage is a neutral view-model so this component stays decoupled
 * from where the data came from (live authorize response, trace, demo run).
 */

import { ArrowDown, ShieldX } from 'lucide-react'

export interface PipelineStage {
  id: string
  label: string
  value?: string
  detail?: string
  tone?: 'neutral' | 'allow' | 'deny' | 'warn' | 'info'
  blocked?: boolean // true = chain terminates here
}

export function PipelineStageCard({ stage, last }: { stage: PipelineStage; last: boolean }) {
  const toneClasses = {
    neutral: 'border-slate-700 bg-slate-900/60',
    allow: 'border-emerald-500/40 bg-emerald-950/30',
    deny: 'border-red-500/50 bg-red-950/30',
    warn: 'border-amber-500/40 bg-amber-950/30',
    info: 'border-sky-500/40 bg-sky-950/30',
  }[stage.tone ?? 'neutral']

  const toneText = {
    neutral: 'text-slate-200',
    allow: 'text-emerald-300',
    deny: 'text-red-300',
    warn: 'text-amber-300',
    info: 'text-sky-300',
  }[stage.tone ?? 'neutral']

  return (
    <div className="animate-fade-up flex flex-col items-center">
      <div className={`w-full max-w-md rounded-lg border px-4 py-3 ${toneClasses}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            {stage.label}
          </span>
          {stage.blocked && <ShieldX className="h-4 w-4 text-red-400" />}
        </div>
        {stage.value && (
          <div className={`mt-1 text-sm font-semibold ${toneText}`}>{stage.value}</div>
        )}
        {stage.detail && <div className="mt-0.5 text-xs text-slate-500">{stage.detail}</div>}
      </div>
      {!last && (
        <div className="flex flex-col items-center py-1">
          {stage.blocked && (
            <span className="my-0.5 rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-300 ring-1 ring-red-500/40">
              Execution Blocked
            </span>
          )}
          <ArrowDown className="h-4 w-4 text-slate-600" />
        </div>
      )}
    </div>
  )
}

export function GovernancePipeline({
  stages,
  emptyHint,
}: {
  stages: PipelineStage[]
  emptyHint?: string
}) {
  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 py-10 text-center">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
          <span>User</span>
          <ArrowDown className="h-3 w-3" />
          <span>Agent</span>
          <ArrowDown className="h-3 w-3" />
          <span>Intent</span>
          <ArrowDown className="h-3 w-3" />
          <span>Policy</span>
          <ArrowDown className="h-3 w-3" />
          <span>JIT Access</span>
          <ArrowDown className="h-3 w-3" />
          <span>Tool</span>
        </div>
        <p className="max-w-md text-sm text-slate-500">
          {emptyHint ?? 'Select a governance decision below to inspect its full pipeline.'}
        </p>
      </div>
    )
  }

  return (
    <div className="py-2">
      {stages.map((stage, i) => (
        <PipelineStageCard key={`${stage.id}-${i}`} stage={stage} last={i === stages.length - 1} />
      ))}
    </div>
  )
}
/** Build the canonical pipeline view-model from a live /authorize response. */
export function pipelineFromAuthorize(
  agentName: string,
  userName: string | null,
  res: {
    decision: string
    risk_score: number
    risk_level: string
    policy_id: string | null
    policy_version: number | null
    reason: string
    intent: { action: string; tool: string | null; amount: number | null; risk_indicators: string[] } | null
    grant: { grant_id: string; expires_at: string } | null
  } | null,
  agentStatus?: string,
): PipelineStage[] {
  if (!res) return []
  const allow = res.decision === 'ALLOW'
  const approval = res.decision === 'REQUIRE_HUMAN_APPROVAL'

  const stages: PipelineStage[] = [
    { id: 'user', label: 'User', value: userName ?? 'service-initiated', tone: 'neutral' },
    {
      id: 'agent',
      label: 'AI Agent',
      value: agentName,
      detail: agentStatus ? `Identity verified · ${agentStatus}` : 'Identity verified',
      tone: 'neutral',
    },
    {
      id: 'intent',
      label: 'Intent',
      value: res.intent?.action ?? '—',
      detail: [
        res.intent?.tool ? `tool: ${res.intent.tool}` : null,
        res.intent?.amount != null ? `amount: ₹${res.intent.amount.toLocaleString('en-IN')}` : null,
        res.intent?.risk_indicators?.length
          ? `indicators: ${res.intent.risk_indicators.join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: res.intent?.risk_indicators?.length ? 'deny' : 'neutral',
    },
    {
      id: 'policy',
      label: 'Policy Evaluation',
      value: `${res.policy_id ?? 'FAIL-CLOSED'}${res.policy_version ? ` v${res.policy_version}` : ''}`,
      detail: `${res.risk_score} risk · ${res.risk_level} — ${res.reason}`,
      tone: allow ? 'allow' : approval ? 'warn' : 'deny',
      blocked: res.decision === 'DENY',
    },
  ]

  if (res.decision === 'DENY') {
    stages.push({
      id: 'result',
      label: 'Result',
      value: 'DENY',
      detail: 'No JIT grant issued · action recorded in audit trail',
      tone: 'deny',
      blocked: true,
    })
    return stages
  }

  if (approval) {
    stages.push({
      id: 'approval',
      label: 'Human Approval',
      value: 'Awaiting review',
      detail: 'Access will be granted only after explicit human approval',
      tone: 'warn',
      blocked: true,
    })
    return stages
  }

  const ttlMinutes = res.grant
    ? Math.max(1, Math.round((new Date(res.grant.expires_at).getTime() - Date.now()) / 60_000))
    : null
  stages.push(
    {
      id: 'grant',
      label: 'JIT Access',
      value: res.grant ? `Grant issued · ${ttlMinutes ?? '?'} min TTL` : '—',
      detail: res.grant ? `grant ${res.grant.grant_id.slice(0, 8)}…` : undefined,
      tone: 'info',
    },
    { id: 'tool', label: 'Tool / MCP', value: res.intent?.tool ?? '—', tone: 'neutral' },
    {
      id: 'result',
      label: 'Result',
      value: 'ALLOW',
      detail: 'Execution permitted within grant scope · audit trail recorded',
      tone: 'allow',
    },
  )
  return stages
}
