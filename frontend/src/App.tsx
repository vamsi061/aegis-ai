import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Agents } from './pages/Agents'
import { AgentDetail } from './pages/AgentDetail'
import { Policies } from './pages/Policies'
import { Approvals } from './pages/Approvals'
import { Delegations } from './pages/Delegations'
import { McpTools } from './pages/McpTools'
import { Audit } from './pages/Audit'
import { TraceDetail } from './pages/TraceDetail'
import { Alerts } from './pages/Alerts'
import { Health } from './pages/Health'
import { DemoPanel } from './pages/DemoPanel'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/demo" element={<DemoPanel />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/:agentId" element={<AgentDetail />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/delegations" element={<Delegations />} />
        <Route path="/mcp-tools" element={<McpTools />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/audit/:traceId" element={<TraceDetail />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/health" element={<Health />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
