/**
 * Page-level tests: dashboard, agents, policies, delegations, approvals,
 * audit trace, alerts and API error handling — all against stubbed backend
 * responses shaped exactly like the real FastAPI contracts.
 */

import { describe, expect, test, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Dashboard } from '../pages/Dashboard'
import { Agents } from '../pages/Agents'
import { AgentDetail } from '../pages/AgentDetail'
import { Policies } from '../pages/Policies'
import { Delegations } from '../pages/Delegations'
import { Approvals } from '../pages/Approvals'
import { Alerts } from '../pages/Alerts'
import { Audit } from '../pages/Audit'
import { renderWithProviders, stubFetch, stubNetworkFailure } from './helpers'
import {
  agentEmail,
  agentTravel,
  alertCritical,
  approvalPending,
  eventDecisionAllow,
  eventDecisionDeny,
  grantActive,
  mcpServer,
  policyTravelAllow,
  policyTravelDeny,
  toolFlightSearch,
} from './fixtures'

afterEach(() => vi.unstubAllGlobals())

const baseHandlers = () => ({
  '/api/v1/agents': () => ({ body: [agentTravel, agentEmail] }),
  // Detail route must be registered separately: '/api/v1/agents/{id}' also
  // contains '/api/v1/agents', and the longest key wins in stubFetch.
  [`/api/v1/agents/${agentTravel.agent_id}`]: () => ({ body: agentTravel }),
  '/api/v1/policies': () => ({ body: [policyTravelAllow, policyTravelDeny] }),
  '/api/v1/audit/events': () => ({ body: [eventDecisionAllow, eventDecisionDeny] }),
  '/api/v1/alerts': () => ({ body: [alertCritical] }),
  '/api/v1/approvals': () => ({ body: [approvalPending] }),
  '/api/v1/grants': () => ({ body: [grantActive] }),
  '/api/v1/delegations': () => ({ body: [] }),
  '/api/v1/mcp/servers': () => ({ body: [mcpServer] }),
  '/api/v1/mcp/tools': () => ({ body: [toolFlightSearch] }),
})

describe('Dashboard', () => {
  test('renders KPI cards from real API data, not hardcoded numbers', async () => {
    stubFetch(baseHandlers())
    renderWithProviders(<Dashboard />)

    expect(await screen.findByText('Governance Overview')).toBeInTheDocument()
    const activeAgents = await screen.findByText('Active Agents')
    // 2 agents in the fixture are ACTIVE -> card must show 2, not an invented value.
    expect(activeAgents.parentElement?.textContent).toContain('2')
  })

  test('shows the governance pipeline and derives decision rows from the API', async () => {
    stubFetch(baseHandlers())
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('Governance Pipeline')).toBeInTheDocument()
    // Decision rows come from /audit/events, so an agent name must appear.
    await waitFor(() => expect(screen.getAllByText('TravelAgent').length).toBeGreaterThan(0))
  })

  test('surfaces a backend error instead of a blank screen', async () => {
    stubNetworkFailure()
    renderWithProviders(<Dashboard />)
    await waitFor(() =>
      expect(screen.getByText(/Failed to load core governance data/i)).toBeInTheDocument(),
    )
  })
})

describe('Agents', () => {
  test('lists agents with identity, owner and capability chips', async () => {
    stubFetch(baseHandlers())
    renderWithProviders(<Agents />)

    expect(await screen.findByRole('link', { name: 'TravelAgent' })).toBeInTheDocument()
    expect(screen.getByText('Travel planning and booking')).toBeInTheDocument()
    expect(screen.getByText('flight_search')).toBeInTheDocument()
  })

  test('filters by status', async () => {
    stubFetch({ ...baseHandlers(), '/api/v1/agents': () => ({ body: [agentTravel] }) })
    renderWithProviders(<Agents />)
    await screen.findByRole('link', { name: 'TravelAgent' })

    await userEvent.selectOptions(screen.getByDisplayValue('All statuses'), 'SUSPENDED')
    await waitFor(() =>
      expect(screen.getByText('No agents match the current filters')).toBeInTheDocument(),
    )
  })

  test('empty registry shows an empty state', async () => {
    stubFetch({ ...baseHandlers(), '/api/v1/agents': () => ({ body: [] }) })
    renderWithProviders(<Agents />)
    expect(await screen.findByText(/No agents match/i)).toBeInTheDocument()
  })
})

describe('Agent detail', () => {
  test('renders identity, purpose and status for the selected agent', async () => {
    stubFetch(baseHandlers())
    renderWithProviders(<AgentDetail />, {
      route: `/agents/${agentTravel.agent_id}`,
      path: '/agents/:agentId',
    })

    expect(await screen.findByText('Travel planning and booking')).toBeInTheDocument()
    expect(screen.getAllByText('user-001').length).toBeGreaterThan(0)
    expect(screen.getByText('DEMO')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Capabilities' })).toBeInTheDocument()
  })

  test('access tab lists real JIT grants with expiry', async () => {
    stubFetch(baseHandlers())
    renderWithProviders(<AgentDetail />, {
      route: `/agents/${agentTravel.agent_id}`,
      path: '/agents/:agentId',
    })
    await screen.findByText('Travel planning and booking')
    await userEvent.click(screen.getByRole('button', { name: 'Access' }))

    await waitFor(() => expect(screen.getByText('flight_search')).toBeInTheDocument())
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0)
    // Grant TTL must be shown so an operator can see when access expires.
    expect(screen.getByText(/expires/i)).toBeInTheDocument()
  })
})

describe('Policies', () => {
  test('lists policies then shows conditions on selection', async () => {
    stubFetch({
      ...baseHandlers(),
      '/api/v1/policies/TRAVEL-002': () => ({
        body: {
          ...policyTravelDeny,
          versions: [
            {
              version: 1,
              conditions: { 'tool.name': 'payment_transfer' },
              decision: 'DENY',
              created_at: '2026-09-15T09:47:52.712494Z',
            },
          ],
        },
      }),
    })
    renderWithProviders(<Policies />)

    expect(await screen.findByText('TRAVEL-001')).toBeInTheDocument()
    await userEvent.click(screen.getByText('TRAVEL-002'))

    await waitFor(() => expect(screen.getByText(/tool\.name/)).toBeInTheDocument())
  })
})

describe('Delegations', () => {
  test('renders the Aegis delegation chain and empty state', async () => {
    stubFetch(baseHandlers())
    renderWithProviders(<Delegations />)
    expect(await screen.findByText(/No delegations recorded/i)).toBeInTheDocument()
  })
})

describe('Approvals', () => {
  test('shows a pending high-risk card with real risk score and both actions', async () => {
    stubFetch(baseHandlers())
    renderWithProviders(<Approvals />)

    expect(await screen.findByText(/High Risk Action/i)).toBeInTheDocument()
    expect(screen.getAllByText('payment_transfer').length).toBe(2)
    expect(screen.getByText(/72/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'APPROVE' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'DENY' })).toBeInTheDocument()
  })

  test('approving calls the backend endpoint and reflects the returned status', async () => {
    const approved = {
      ...approvalPending,
      status: 'APPROVED' as const,
      resolved_by: 'user-admin',
      resolution_reason: 'Reviewed in governance console',
    }
    const handlers: Record<string, () => { status?: number; body: unknown }> = {
      ...baseHandlers(),
      // The approve action must hit the real endpoint and echo the new status.
      [`/api/v1/approvals/${approvalPending.approval_id}/approve`]: () => ({ body: approved }),
    }
    const { calls } = stubFetch(handlers)
    renderWithProviders(<Approvals />)

    await screen.findByText(/High Risk Action/i)
    await userEvent.click(screen.getByRole('button', { name: 'APPROVE' }))

    await waitFor(() => expect(screen.getByText(/APPROVED — /)).toBeInTheDocument())
    expect(screen.getByText('Reviewed in governance console')).toBeInTheDocument()

    const posted = calls.find((c) => c.method === 'POST')
    expect(posted?.url).toContain(`/approvals/${approvalPending.approval_id}/approve`)
    // The approver identity and reason are sent to the backend.
    expect(posted?.body).toContain('user-admin')
  })

  test('no pending approvals shows an explanatory empty state', async () => {
    stubFetch({ ...baseHandlers(), '/api/v1/approvals': () => ({ body: [] }) })
    renderWithProviders(<Approvals />)
    expect(await screen.findByText('No pending approvals')).toBeInTheDocument()
  })
})

describe('Audit', () => {
  test('renders audit rows with decision, risk and trace', async () => {
    stubFetch(baseHandlers())
    renderWithProviders(<Audit />)

    expect(await screen.findByText('Audit & Lineage')).toBeInTheDocument()
    const rows = await screen.findAllByText('POLICY DECISION')
    expect(rows.length).toBeGreaterThan(0)
    expect(screen.getByText('TRAVEL-001')).toBeInTheDocument()
  })
})

describe('Alerts', () => {
  test('renders severity, agent and description with resolve action', async () => {
    stubFetch(baseHandlers())
    renderWithProviders(<Alerts />)

    expect((await screen.findAllByText('CRITICAL')).length).toBeGreaterThan(0)
    expect(await screen.findByText('PROMPT INJECTION')).toBeInTheDocument()
    expect(
      screen.getByText('Potential instruction override and data exfiltration attempt'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument()
  })

  test('severity filter narrows the list', async () => {
    stubFetch({
      ...baseHandlers(),
      '/api/v1/alerts': () => ({
        body: [
          alertCritical,
          {
            ...alertCritical,
            alert_id: 'low-1',
            alert_type: 'SCOPE_VIOLATION',
            severity: 'LOW',
          },
        ],
      }),
    })
    renderWithProviders(<Alerts />)

    // Both alerts visible before filtering.
    expect(await screen.findByText('PROMPT INJECTION')).toBeInTheDocument()
    expect(screen.getByText('SCOPE VIOLATION')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'LOW' }))

    // Only the LOW alert survives the filter.
    await waitFor(() => expect(screen.getByText('SCOPE VIOLATION')).toBeInTheDocument())
    expect(screen.queryByText('PROMPT INJECTION')).not.toBeInTheDocument()
  })
})

describe('API error handling', () => {
  test('backend unreachable shows actionable guidance', async () => {
    stubNetworkFailure()
    renderWithProviders(<Agents />)
    await waitFor(() =>
      expect(
        screen.getByText(/Unable to reach Aegis backend/i),
      ).toBeInTheDocument(),
    )
  })

  test('500 response is surfaced with a stable error code, not swallowed', async () => {
    stubFetch({ '/api/v1/agents': () => ({ status: 500, body: { detail: 'boom' } }) })
    renderWithProviders(<Agents />)
    await waitFor(() => expect(screen.getByText('Error code: ERROR')).toBeInTheDocument())
  })

  test('empty audit result shows an empty state', async () => {
    stubFetch({ ...baseHandlers(), '/api/v1/audit/events': () => ({ body: [] }) })
    renderWithProviders(<Audit />)
    expect(await screen.findByText('No matching audit events')).toBeInTheDocument()
  })
})
