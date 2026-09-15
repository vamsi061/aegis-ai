import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ShieldCheck, UserCircle, Wifi, WifiOff } from 'lucide-react'
import { useHealth, useReady } from '../api/hooks'

export function Topbar() {
  const { isError } = useHealth()
  const { data: ready } = useReady()
  const qc = useQueryClient()

  const connected = !isError
  const dbReady = ready?.ready ?? false

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-400" />
        <span className="text-sm font-semibold text-slate-200">Aegis AI</span>
        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-amber-500/40">
          Demo Environment
        </span>
      </div>

      <div className="flex items-center gap-5">
        <div
          className="flex items-center gap-1.5 text-xs"
          title={connected ? 'FastAPI on localhost:8000' : 'Backend unreachable'}
        >
          {connected ? (
            <Wifi className="h-4 w-4 text-emerald-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-400" />
          )}
          <span className={connected ? 'text-slate-400' : 'text-red-400'}>
            {connected ? 'Backend connected' : 'Backend offline'}
          </span>
          {connected && (
            <span
              className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${dbReady ? 'bg-emerald-400' : 'bg-amber-400'}`}
              title={dbReady ? 'Database ready' : 'Database not ready'}
            />
          )}
        </div>

        <button
          onClick={() => void qc.invalidateQueries()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          title="Refresh all data"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-2 border-l border-slate-800 pl-5">
          <UserCircle className="h-6 w-6 text-slate-500" />
          <div className="text-xs leading-tight">
            <div className="font-medium text-slate-300">Aegis Administrator</div>
            <div className="text-slate-600">user-admin</div>
          </div>
        </div>
      </div>
    </header>
  )
}
