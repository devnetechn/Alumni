import { useEffect, useState } from 'react';
import {
  Users, Calendar, CheckCircle2, MessageSquare,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '../api';
import { StatTile } from '../components/ui';
import { CHART_COLORS, chartTooltipStyle, chartAxisProps, chartGridProps } from '../lib/chartTheme';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/stats').then((r) => setStats(r.data));
  }, []);

  if (!stats) return <div className="p-8 text-slate-500">Loading analytics...</div>;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--brand-ink)]">Analytics Dashboard</h1>
        <p className="text-slate-500 mt-1">Real-time insights into your alumni community</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total Alumni" value={stats.totalAlumni} icon={Users} />
        <StatTile label="Total Events" value={stats.totalEvents} icon={Calendar} />
        <StatTile label="Check-ins" value={stats.totalCheckins} icon={CheckCircle2} />
        <StatTile label="Messages Sent" value={stats.totalMessages} icon={MessageSquare} />
      </div>

      {/* Line chart — Registrations trend */}
      <Panel title="Registrations & Check-ins Trend" subtitle="Last 12 months">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={mergeTrends(stats.registrationsTrend, stats.checkinsTrend)}>
            <CartesianGrid {...chartGridProps} vertical={false} />
            <XAxis dataKey="label" {...chartAxisProps} />
            <YAxis {...chartAxisProps} allowDecimals={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Area type="monotone" dataKey="registrations" stroke={CHART_COLORS[0]} strokeWidth={2.5} fill={CHART_COLORS[0]} fillOpacity={0.15} name="New Alumni" />
            <Area type="monotone" dataKey="checkins" stroke={CHART_COLORS[1]} strokeWidth={2.5} fill={CHART_COLORS[1]} fillOpacity={0.15} name="Event Check-ins" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Bar — Alumni by batch */}
        <Panel title="Alumni by Batch Year">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.byBatch}>
              <CartesianGrid {...chartGridProps} vertical={false} />
              <XAxis dataKey="label" {...chartAxisProps} />
              <YAxis {...chartAxisProps} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--brand-surface)' }} />
              <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[2, 2, 0, 0]} name="Alumni" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Pie — Industry distribution */}
        <Panel title="Industry Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={stats.byIndustry}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
              >
                {stats.byIndustry.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        {/* Line — Events by month */}
        <Panel title="Events by Month">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.eventsByMonth}>
              <CartesianGrid {...chartGridProps} vertical={false} />
              <XAxis dataKey="label" {...chartAxisProps} />
              <YAxis {...chartAxisProps} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[2]} strokeWidth={3} dot={{ fill: CHART_COLORS[2], r: 5 }} activeDot={{ r: 7 }} name="Events" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* Horizontal bar — Top companies */}
        <Panel title="Top Companies">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.topCompanies} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid {...chartGridProps} horizontal={false} />
              <XAxis type="number" {...chartAxisProps} allowDecimals={false} />
              <YAxis type="category" dataKey="label" {...chartAxisProps} width={100} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--brand-surface)' }} />
              <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[0, 2, 2, 0]} name="Alumni" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Courses pie */}
        <Panel title="Course Distribution" full>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={stats.byCourse}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {stats.byCourse.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

function mergeTrends(reg, checkins) {
  const map = {};
  reg.forEach((r) => { map[r.label] = { label: r.label, registrations: r.value, checkins: 0 }; });
  checkins.forEach((c) => {
    if (map[c.label]) map[c.label].checkins = c.value;
    else map[c.label] = { label: c.label, registrations: 0, checkins: c.value };
  });
  return Object.values(map);
}

function Panel({ title, subtitle, children, full }) {
  return (
    <div className={`bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] shadow-[4px_4px_0_var(--brand-ink)] p-6 ${full ? 'lg:col-span-2' : ''}`}>
      <div className="mb-4">
        <h2 className="font-display text-lg text-[var(--brand-ink)]">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
