/**
 * Semantic governance status indicators.
 * Color + icon + text label — never color alone (§23).
 */

import { Ban, CheckCircle2, Clock, Gauge, ShieldX } from 'lucide-react'

const DECISION_STYLES: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  ALLOW: {
    label: 'ALLOW',
    className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40',
    icon: CheckCircle2,
  },
  DENY: {
    label: 'DENY',
    className: 'bg-red-500/10 text-red-300 ring-red-500/40',
    icon: Ban,
  },
  REQUIRE_HUMAN_APPROVAL: {
    label: 'APPROVAL REQUIRED',
    className: 'bg-amber-500/10 text-amber-300 ring-amber-500/40',
    icon: Clock,
  },
  RATE_LIMIT: {
    label: 'RATE LIMITED',
    className: 'bg-sky-500/10 text-sky-300 ring-sky-500/40',
    icon: Gauge,
  },
  BLOCKED: {
    label: 'BLOCKED',
    className: 'bg-red-500/10 text-red-300 ring-red-500/40',
    icon: ShieldX,
  },
}

export function DecisionBadge({ decision, size = 'md' }: { decision: string | null | undefined; size?: 'sm' | 'md' }) {
  if (!decision) {
    return <span className="text-xs text-slate-600">—</span>
  }
  const style = DECISION_STYLES[decision] ?? {
    label: decision,
    className: 'bg-slate-500/10 text-slate-300 ring-slate-500/40',
    icon: CheckCircle2,
  }
  const Icon = style.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-semibold uppercase tracking-wide ring-1 ${style.className} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      }`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {style.label}
    </span>
  )
}

const RISK_STYLES: Record<string, { className: string; dot: string }> = {
  LOW: { className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40', dot: 'bg-emerald-400' },
  MEDIUM: { className: 'bg-sky-500/10 text-sky-300 ring-sky-500/40', dot: 'bg-sky-400' },
  HIGH: { className: 'bg-amber-500/10 text-amber-300 ring-amber-500/40', dot: 'bg-amber-400' },
  CRITICAL: { className: 'bg-red-500/10 text-red-300 ring-red-500/40', dot: 'bg-red-400' },
}

export function riskLevelOf(score: number | null | undefined): string {
  if (score == null) return 'LOW'
  if (score >= 75) return 'CRITICAL'
  if (score >= 50) return 'HIGH'
  if (score >= 25) return 'MEDIUM'
  return 'LOW'
}

export function RiskBadge({ score, level }: { score?: number | null; level?: string }) {
  const resolved = level ?? riskLevelOf(score)
  const style = RISK_STYLES[resolved] ?? RISK_STYLES.LOW
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${style.className}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {score != null ? `${score} · ${resolved}` : resolved}
    </span>
  )
}

const STATUS_STYLES: Record<string, { className: string; dot: string }> = {
  ACTIVE: { className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40', dot: 'bg-emerald-400' },
  PENDING: { className: 'bg-slate-500/10 text-slate-300 ring-slate-500/40', dot: 'bg-slate-400' },
  SUSPENDED: { className: 'bg-amber-500/10 text-amber-300 ring-amber-500/40', dot: 'bg-amber-400' },
  RETIRED: { className: 'bg-slate-600/20 text-slate-400 ring-slate-600/40', dot: 'bg-slate-500' },
  OPEN: { className: 'bg-red-500/10 text-red-300 ring-red-500/40', dot: 'bg-red-400' },
  RESOLVED: { className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40', dot: 'bg-emerald-400' },
  APPROVED: { className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40', dot: 'bg-emerald-400' },
  DENIED: { className: 'bg-red-500/10 text-red-300 ring-red-500/40', dot: 'bg-red-400' },
  EXPIRED: { className: 'bg-slate-500/10 text-slate-400 ring-slate-500/40', dot: 'bg-slate-500' },
  REVOKED: { className: 'bg-red-500/10 text-red-300 ring-red-500/40', dot: 'bg-red-400' },
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-slate-600">—</span>
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${style.className}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  )
}

const SEVERITY_STYLES: Record<string, { className: string }> = {
  CRITICAL: { className: 'bg-red-500/15 text-red-300 ring-red-500/50' },
  HIGH: { className: 'bg-amber-500/15 text-amber-300 ring-amber-500/50' },
  MEDIUM: { className: 'bg-sky-500/15 text-sky-300 ring-sky-500/50' },
  LOW: { className: 'bg-slate-500/15 text-slate-300 ring-slate-500/50' },
}

export function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.LOW
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1 ${style.className}`}
    >
      {severity}
    </span>
  )
}
