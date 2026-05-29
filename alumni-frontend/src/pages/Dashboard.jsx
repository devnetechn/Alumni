import { useEffect, useState } from 'react';
import {
  Users, Calendar, CheckCircle2, MessageSquare, TrendingUp, ArrowUpRight,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '../api';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#84cc16'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/stats').then((r) => setStats(r.data));
  }, []);

  if (!stats) return <div className="p-8 text-slate-500">Loading analytics...</div>;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
        <p className="text-slate-500 mt-1">Real-time insights into your alumni community</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Alumni" value={stats.totalAlumni} icon={Users} gradient="from-blue-500 to-indigo-600" />
        <StatCard label="Total Events" value={stats.totalEvents} icon={Calendar} gradient="from-emerald-500 to-teal-600" />
        <StatCard label="Check-ins" value={stats.totalCheckins} icon={CheckCircle2} gradient="from-purple-500 to-pink-600" />
        <StatCard label="Messages Sent" value={stats.totalMessages} icon={MessageSquare} gradient="from-amber-500 to-orange-600" />
      </div>

      {/* Line chart — Registrations trend */}
      <Panel title="Registrations & Check-ins Trend" subtitle="Last 12 months">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={mergeTrends(stats.registrationsTrend, stats.checkinsTrend)}>
            <defs>
              <linearGradient id="gReg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gCheck" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ec4899" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Area type="monotone" dataKey="registrations" stroke="#6366f1" strokeWidth={2.5} fill="url(#gReg)" name="New Alumni" />
            <Area type="monotone" dataKey="checkins" stroke="#ec4899" strokeWidth={2.5} fill="url(#gCheck)" name="Event Check-ins" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Bar — Alumni by batch */}
        <Panel title="Alumni by Batch Year">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.byBatch}>
              <defs>
                <linearGradient id="gBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" fill="url(#gBar)" radius={[8, 8, 0, 0]} name="Alumni" />
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
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        {/* Line — Events by month */}
        <Panel title="Events by Month">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.eventsByMonth}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} activeDot={{ r: 7 }} name="Events" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* Horizontal bar — Top companies */}
        <Panel title="Top Companies">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.topCompanies} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={12} width={100} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" fill="#f59e0b" radius={[0, 8, 8, 0]} name="Alumni" />
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
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
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

const tooltipStyle = {
  background: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 13,
};

function StatCard({ label, value, icon: Icon, gradient }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`bg-gradient-to-br ${gradient} p-2.5 rounded-xl`}>
          <Icon className="text-white" size={20} />
        </div>
        <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-bold">
          <ArrowUpRight size={12} />
          Live
        </div>
      </div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-extrabold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, children, full }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-6 ${full ? 'lg:col-span-2' : ''}`}>
      <div className="mb-4">
        <h2 className="font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
