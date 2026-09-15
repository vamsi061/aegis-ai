/**
 * Central HTTP client for the Aegis backend.
 * - Base URL: same-origin `/api/v1` (Vite dev proxy → FastAPI :8000).
 * - Consistent error surface: ApiError {status, code, message}.
 * - Request correlation via X-Request-ID.
 * - Auth placeholder: attachToken() ready for a future bearer token.
 */

const BASE_URL = '/api/v1'
const DEFAULT_TIMEOUT_MS = 10_000

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  get isBackendUnreachable(): boolean {
    return this.status === 0
  }
}

let authToken: string | null = null

/** Auth placeholder — set once a real identity flow exists. */
export function attachToken(token: string | null): void {
  authToken = token
}

function requestId(): string {
  return crypto.randomUUID()
}

function extractError(payload: unknown, status: number): ApiError {
  // FastAPI validation errors (422) arrive as {detail: [{loc, msg, ...}]}.
  if (status === 422 && payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string; loc?: unknown[] } | undefined
      return new ApiError(422, 'VALIDATION_ERROR', first?.msg ?? 'Invalid request parameters')
    }
    if (typeof detail === 'string') return new ApiError(422, 'VALIDATION_ERROR', detail)
  }
  // Structured errors: {detail: {error, code}} (our handlers) or {detail: string}.
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail
    if (detail && typeof detail === 'object' && 'error' in detail) {
      const d = detail as { error: string; code?: string }
      return new ApiError(status, d.code ?? 'ERROR', d.error)
    }
    if (typeof detail === 'string') {
      return new ApiError(status, 'ERROR', detail)
    }
  }
  return new ApiError(status, 'ERROR', `Request failed with status ${status}`)
}

async function request<T>(
  method: string,
  path: string,
  options: {
    query?: Record<string, string | number | boolean | undefined>
    body?: unknown
    timeoutMs?: number
  } = {},
): Promise<T> {
  const { query, body, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  const url = new URL(BASE_URL + path, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url.pathname + url.search, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId(),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        /* non-JSON error body */
      }
      throw extractError(payload, response.status)
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', `Request timed out after ${timeoutMs}ms`)
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Unable to reach Aegis backend. Check that FastAPI is running on localhost:8000.',
    )
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  get: <T>(path: string, query?: Record<string, string | number | boolean | undefined>) =>
    request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
}
