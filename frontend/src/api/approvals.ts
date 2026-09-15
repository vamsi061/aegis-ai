import { api } from './client'
import type { Approval } from './types'

export const approvalsApi = {
  list: (status?: Approval['status']) => api.get<Approval[]>('/approvals', { status }),
  get: (approvalId: string) => api.get<Approval>(`/approvals/${approvalId}`),
  approve: (approvalId: string, approverId: string, reason?: string) =>
    api.post<Approval>(`/approvals/${approvalId}/approve`, {
      approver_id: approverId,
      reason,
    }),
  deny: (approvalId: string, approverId: string, reason?: string) =>
    api.post<Approval>(`/approvals/${approvalId}/deny`, { approver_id: approverId, reason }),
}
