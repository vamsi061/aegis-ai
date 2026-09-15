/**
 * Test render helper: real providers (QueryClient + Router), stub fetch.
 * Components are exercised with their production code paths — no mocks of
 * application modules, so API-client error handling is genuinely tested.
 */

import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path }: { route?: string; path?: string } = {},
): RenderResult {
  // retry:false so error states surface immediately in tests.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })

  const element = path ? (
    <Routes>
      <Route path={path} element={ui} />
    </Routes>
  ) : (
    ui
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Install a fetch stub that answers by URL substring. */
export function stubFetch(handlers: Record<string, () => { status?: number; body: unknown }>) {
  const calls: { url: string; method: string; body?: string }[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? String(init.body) : undefined,
    })
    // Longest matching key wins, so "/api/v1/alerts/x/resolve" doesn't fall
    // through to the "/api/v1/alerts" list handler.
    const key = Object.keys(handlers)
      .filter((k) => url.includes(k))
      .sort((a, b) => b.length - a.length)[0]
    if (!key) {
      return new Response(JSON.stringify({ detail: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { status = 200, body } = handlers[key]()
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

/** Simulate the backend being unreachable (network failure). */
export function stubNetworkFailure() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }),
  )
}
