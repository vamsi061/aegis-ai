/**
 * Server-state hooks (TanStack Query). The only place components touch data:
 * components never call fetch/axios directly. Mutations invalidate the
 * affected queries so every surface reflects real backend state.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentsApi } from './agents'
import { authorizationApi, type AuthorizePayload } from './authorization'
import { approvalsApi } from './approvals'
import { delegationsApi } from './delegations'
import { policiesApi } from './policies'
import { mcpApi } from './mcp'
import { auditApi, grantsApi, type AuditEventFilters } from './audit'
import { alertsApi, healthApi } from './alerts'
import type { SecurityAlert } from './types'

export const queryKeys = {
  health: ['health'] as const,
  ready: ['ready'] as const,
  agents: ['agents'] as const,
  agent: (id: string) => ['agents', id] as const,
  policies: ['policies'] as const,
  policy: (key: string) => ['policies', key] as const,
  approvals: (status?: string) => ['approvals', status ?? 'all'] as const,
  delegations: (activeOnly: boolean) => ['delegations', activeOnly] as const,
  servers: ['mcp-servers'] as const,
  tools: ['mcp-tools'] as const,
  audit: (filters: AuditEventFilters) => ['audit', filters] as const,
  trace: (traceId: string) => ['trace', traceId] as const,
  grants: (agentId?: string, activeOnly?: boolean) => ['grants', agentId, activeOnly] as const,
  alerts: (status?: string) => ['alerts', status ?? 'all'] as const,
}

const POLL = { refetchInterval: 8_000 } as const

// --- Health -----------------------------------------------------------------

export const useHealth = () =>
  useQuery({ queryKey: queryKeys.health, queryFn: () => healthApi.health(), ...POLL })

export const useReady = () =>
  useQuery({ queryKey: queryKeys.ready, queryFn: () => healthApi.ready(), ...POLL })

// --- Agents ------------------------------------------------------------------

export const useAgents = () =>
  useQuery({ queryKey: queryKeys.agents, queryFn: () => agentsApi.list(), ...POLL })

export const useAgent = (agentId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.agent(agentId ?? ''),
    queryFn: () => agentsApi.get(agentId!),
    enabled: Boolean(agentId),
  })

export function useAgentLifecycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, action }: { agentId: string; action: 'activate' | 'suspend' | 'retire' }) =>
      agentsApi[action](agentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.agents })
      void qc.invalidateQueries({ queryKey: ['grants'] })
      void qc.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}

// --- Authorization -------------------------------------------------------------

export const useAuthorize = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AuthorizePayload) => authorizationApi.authorize(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['audit'] })
      void qc.invalidateQueries({ queryKey: ['grants'] })
      void qc.invalidateQueries({ queryKey: queryKeys.approvals('PENDING') })
    },
  })
}

export const useExecuteTool = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ toolName, grantId, input }: { toolName: string; grantId: string; input: Record<string, unknown> }) =>
      authorizationApi.executeTool(toolName, grantId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}

// --- Approvals --------------------------------------------------------------------

export const useApprovals = (status?: string) =>
  useQuery({ queryKey: queryKeys.approvals(status), queryFn: () => approvalsApi.list(status as never), ...POLL })

export function useApprovalResolution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      approvalId,
      action,
      approverId,
      reason,
    }: {
      approvalId: string
      action: 'approve' | 'deny'
      approverId: string
      reason?: string
    }) => approvalsApi[action](approvalId, approverId, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      void qc.invalidateQueries({ queryKey: ['audit'] })
      void qc.invalidateQueries({ queryKey: ['grants'] })
    },
  })
}

// --- Delegations ----------------------------------------------------------------------

export const useDelegations = (activeOnly = false) =>
  useQuery({ queryKey: queryKeys.delegations(activeOnly), queryFn: () => delegationsApi.list(activeOnly), ...POLL })

export function useCreateDelegation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: delegationsApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['delegations'] })
      void qc.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}

// --- Policies / MCP ----------------------------------------------------------------------

export const usePolicies = () =>
  useQuery({ queryKey: queryKeys.policies, queryFn: () => policiesApi.list() })

export const usePolicy = (policyKey: string | undefined) =>
  useQuery({
    queryKey: queryKeys.policy(policyKey ?? ''),
    queryFn: () => policiesApi.get(policyKey!),
    enabled: Boolean(policyKey),
  })

export const useMcpServers = () =>
  useQuery({ queryKey: queryKeys.servers, queryFn: () => mcpApi.listServers() })

export const useMcpTools = () =>
  useQuery({ queryKey: queryKeys.tools, queryFn: () => mcpApi.listTools() })

// --- Audit / Grants -------------------------------------------------------------------------

export const useAuditEvents = (filters: AuditEventFilters = {}) =>
  useQuery({ queryKey: queryKeys.audit(filters), queryFn: () => auditApi.listEvents(filters), ...POLL })

export const useTrace = (traceId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.trace(traceId ?? ''),
    queryFn: () => auditApi.getTrace(traceId!),
    enabled: Boolean(traceId),
  })

export const useGrants = (agentId?: string, activeOnly?: boolean) =>
  useQuery({
    queryKey: queryKeys.grants(agentId, activeOnly),
    queryFn: () => grantsApi.list({ agent_id: agentId, active_only: activeOnly }),
    ...POLL,
  })

// --- Alerts --------------------------------------------------------------------------------------

export const useAlerts = (status?: SecurityAlert['status']) =>
  useQuery({ queryKey: queryKeys.alerts(status), queryFn: () => alertsApi.list(status), ...POLL })

export function useAlertResolution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ alertId, reason }: { alertId: string; reason?: string }) =>
      alertsApi.resolve(alertId, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}
