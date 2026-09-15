import { api } from './client'
import type { Delegation } from './types'

export const delegationsApi = {
  list: (activeOnly = false) => api.get<Delegation[]>('/delegations', { active_only: activeOnly }),
  create: (body: {
    source_agent_id: string
    target_agent_id: string
    requested_scope: { capabilities: string[] }
    ttl_seconds: number
  }) => api.post<Delegation>('/delegations', body),
}
