import { api } from './client'
import type { McpServer, McpTool } from './types'

export const mcpApi = {
  listServers: () => api.get<McpServer[]>('/mcp/servers'),
  listTools: () => api.get<McpTool[]>('/mcp/tools'),
}
