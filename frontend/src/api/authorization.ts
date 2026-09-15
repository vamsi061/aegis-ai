import { api } from './client'
import type { AuthorizeResponse, ToolExecutionResult } from './types'

export interface AuthorizePayload {
  agent_id: string
  initiating_user_id?: string
  action: string
  tool: string
  target?: string | null
  input?: Record<string, unknown>
  context?: Record<string, unknown>
}

export const authorizationApi = {
  authorize: (payload: AuthorizePayload) =>
    api.post<AuthorizeResponse>('/authorize', payload),

  executeTool: (toolName: string, grantId: string, input: Record<string, unknown>) =>
    api.post<ToolExecutionResult>(`/tools/${toolName}/execute`, {
      grant_id: grantId,
      input,
    }),
}
