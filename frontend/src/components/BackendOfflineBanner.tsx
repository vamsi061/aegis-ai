import { useHealth } from '../api/hooks'
import { ApiError } from '../api/client'

/**
 * Global, non-intrusive banner when the backend is unreachable.
 * Pages still render their own skeletons/empty states; this explains why.
 */
export function BackendOfflineBanner() {
  const { error, isError } = useHealth()
  if (!isError) return null

  const unreachable =
    error instanceof ApiError && (error.isBackendUnreachable || error.code === 'TIMEOUT')

  return (
    <div className="border-b border-red-900/60 bg-red-950/40 px-6 py-2 text-xs text-red-300">
      {unreachable
        ? 'Unable to reach Aegis backend. Check that FastAPI is running on localhost:8000.'
        : `Backend error: ${error instanceof Error ? error.message : 'unknown error'}`}
    </div>
  )
}
