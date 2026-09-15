import { api } from './client'
import type { AccessGrant, AuditEvent, TraceDetail } from './types'

export interface AuditEventFilters {
  trace_id?: string
  agent_id?: string
  decision?: string
  event_type?: string
  since?: string
  until?: string
  limit?: number
  [key: string]: string | number | undefined
}

export const auditApi = {
  listEvents: (filters: AuditEventFilters = {}) => api.get<AuditEvent[]>('/audit/events', filters),
  getTrace: (traceId: string) => api.get<TraceDetail>(`/audit/traces/${traceId}`),
}

export const grantsApi = {
  list: (params: { agent_id?: string; active_only?: boolean } = {}) =>
    api.get<AccessGrant[]>('/grants', params),
  get: (grantId: string) => api.get<AccessGrant>(`/grants/${grantId}`),
}
