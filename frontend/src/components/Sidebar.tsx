import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  ArrowLeftRight,
  Bell,
  Bot,
  FileSearch,
  HeartPulse,
  ScrollText,
  ShieldCheck,
  Wrench,
  Gauge,
  Play,
} from 'lucide-react'
import { useAlerts, useApprovals } from '../api/hooks'

const NAV: { to: string; label: string; icon: typeof Gauge; badge?: 'approvals' | 'alerts' }[] = [
  { to: '/dashboard', label: 'Overview', icon: Gauge },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/policies', label: 'Policies', icon: ScrollText },
  { to: '/approvals', label: 'Approvals', icon: FileSearch, badge: 'approvals' },
  { to: '/delegations', label: 'A2A Delegations', icon: ArrowLeftRight },
  { to: '/mcp-tools', label: 'MCP & Tools', icon: Wrench },
  { to: '/audit', label: 'Audit & Lineage', icon: Activity },
  { to: '/alerts', label: 'Security Alerts', icon: Bell, badge: 'alerts' },
  { to: '/demo', label: 'Demo Mode', icon: Play },
]

export function Sidebar() {
  const { data: pendingApprovals } = useApprovals('PENDING')
  const { data: openAlerts } = useAlerts('OPEN')

  const badgeCount = (kind?: string) => {
    if (kind === 'approvals') return pendingApprovals?.length ?? 0
    if (kind === 'alerts') return openAlerts?.length ?? 0
    return 0
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60">
      <div className="flex items-center gap-2.5 border-b border-slate-800 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/40">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-wide text-slate-100">AEGIS AI</div>
          <div className="text-[11px] text-slate-500">Governance Console</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map(({ to, label, icon: Icon, badge }) => {
          const count = badgeCount(badge)
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-500/10 font-medium text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {count > 0 && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/40">
                  {count}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 px-3 py-4">
        <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          System
        </div>
        <NavLink
          to="/health"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-emerald-500/10 font-medium text-emerald-300 ring-1 ring-emerald-500/30'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`
          }
        >
          <HeartPulse className="h-4 w-4 shrink-0" />
          Health
        </NavLink>
      </div>
    </aside>
  )
}

/** Kept for potential reuse of location-aware highlighting. */
export function useActivePath(): string {
  const location = useLocation()
  return location.pathname
}
