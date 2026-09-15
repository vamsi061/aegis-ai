import { api } from './client'
import type { HealthStatus, ReadyStatus, SecurityAlert } from './types'

export const alertsApi = {
  list: (status?: SecurityAlert['status']) => api.get<SecurityAlert[]>('/alerts', { status }),
  resolve: (alertId: string, reason?: string) =>
    api.post<SecurityAlert>(`/alerts/${alertId}/resolve`, { reason }),
}

export const healthApi = {
  health: () => api.get<HealthStatus>('/health'),
  ready: () => api.get<ReadyStatus>('/ready'),
}
