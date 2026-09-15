import { api } from './client'
import type { PolicyDetail, PolicySummary } from './types'

export const policiesApi = {
  list: () => api.get<PolicySummary[]>('/policies'),
  get: (policyKey: string) => api.get<PolicyDetail>(`/policies/${policyKey}`),
}
