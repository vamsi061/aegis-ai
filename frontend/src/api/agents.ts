import { api } from './client'
import type { Agent, AgentStatus } from './types'

export const agentsApi = {
  list: (status?: AgentStatus) => api.get<Agent[]>('/agents', { status }),
  get: (agentId: string) => api.get<Agent>(`/agents/${agentId}`),
  update: (agentId: string, body: Partial<Agent>) => api.patch<Agent>(`/agents/${agentId}`, body),
  activate: (agentId: string) =>
    api.post<{ agent_id: string; status: AgentStatus; revoked_grants: number }>(
      `/agents/${agentId}/activate`,
    ),
  suspend: (agentId: string) =>
    api.post<{ agent_id: string; status: AgentStatus; revoked_grants: number }>(
      `/agents/${agentId}/suspend`,
    ),
  retire: (agentId: string) =>
    api.post<{ agent_id: string; status: AgentStatus; revoked_grants: number }>(
      `/agents/${agentId}/retire`,
    ),
}
