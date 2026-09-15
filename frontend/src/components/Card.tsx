import type { ReactNode } from 'react'

// Re-exported for convenient one-line imports in pages.
export { PageHeader } from './States'

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/40 ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'allow' | 'deny' | 'warn' | 'info'
}) {
  const toneRing = {
    default: 'ring-slate-800',
    allow: 'ring-emerald-500/30',
    deny: 'ring-red-500/30',
    warn: 'ring-amber-500/30',
    info: 'ring-sky-500/30',
  }[tone]
  const toneText = {
    default: 'text-slate-100',
    allow: 'text-emerald-300',
    deny: 'text-red-300',
    warn: 'text-amber-300',
    info: 'text-sky-300',
  }[tone]
  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/40 p-4 ring-1 ${toneRing}`}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneText}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-600">{hint}</div>}
    </div>
  )
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function shortId(id: string | null | undefined, chars = 8): string {
  if (!id) return '—'
  return id.length > chars ? `${id.slice(0, chars)}…` : id
}
