import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, } from '../../components/Card'
import { EmptyState } from '../../components/States'
import type { ActivityBucket, RiskBucket } from '../../lib/dashboard'

const RISK_COLORS: Record<string, string> = {
  LOW: '#34d399',
  MEDIUM: '#38bdf8',
  HIGH: '#fbbf24',
  CRITICAL: '#f87171',
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
} as const

export function ActivityChart({ data }: { data: ActivityBucket[] }) {
  return (
    <Card title="Authorization Activity" subtitle="ALLOW / DENY / APPROVAL over time" className="xl:col-span-2">
      {data.length === 0 ? (
        <EmptyState title="No authorization decisions yet" hint="Run a demo scenario to see live activity." />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} stroke="#334155" />
            <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} stroke="#334155" />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ALLOW" stackId="d" fill="#34d399" />
            <Bar dataKey="DENY" stackId="d" fill="#f87171" />
            <Bar dataKey="APPROVAL" stackId="d" fill="#fbbf24" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export function RiskChart({ data }: { data: RiskBucket[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  return (
    <Card title="Risk Overview" subtitle="Distribution of decision risk scores">
      {total === 0 ? (
        <EmptyState title="No risk data yet" />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="level"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.level} fill={RISK_COLORS[entry.level]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
