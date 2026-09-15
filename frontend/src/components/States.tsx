import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, WifiOff } from 'lucide-react'
import { ApiError } from '../api/client'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-800 ${className}`} />
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-9 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-800 py-12 text-center">
      <Inbox className="h-8 w-8 text-slate-700" />
      <div className="text-sm font-medium text-slate-400">{title}</div>
      {hint && <div className="max-w-sm text-xs text-slate-600">{hint}</div>}
    </div>
  )
}

export function ErrorState({ error, reset }: { error: unknown; reset?: () => void }) {
  const unreachable =
    error instanceof ApiError && (error.isBackendUnreachable || error.code === 'TIMEOUT')
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-900/50 bg-red-950/20 py-12 text-center">
      {unreachable ? (
        <WifiOff className="h-8 w-8 text-red-400" />
      ) : (
        <AlertTriangle className="h-8 w-8 text-red-400" />
      )}
      <div className="text-sm font-medium text-red-300">
        {unreachable
          ? 'Unable to reach Aegis backend.'
          : error instanceof ApiError
            ? error.message
            : 'Something went wrong.'}
      </div>
      <div className="max-w-sm text-xs text-slate-500">
        {unreachable
          ? 'Check that FastAPI is running on localhost:8000.'
          : error instanceof ApiError
            ? `Error code: ${error.code}`
            : undefined}
      </div>
      {reset && (
        <button
          onClick={reset}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label ?? 'Loading…'}
    </div>
  )
}
