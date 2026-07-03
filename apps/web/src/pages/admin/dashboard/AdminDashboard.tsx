import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, CreditCard, Ticket, AlertTriangle,
  DollarSign, Activity, Shield, ArrowUpRight,
  CheckCircle2, XCircle, Zap
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { api } from '../../../lib/adminAxios';
import { formatCurrency } from '@vpay/utils';
import type { PlatformMetrics } from '@vpay/types';

// Mock chart data (replace with real data from API)
const volumeData = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
  volume: Math.floor(Math.random() * 80000 + 20000),
  cards: Math.floor(Math.random() * 200 + 50),
  fees: Math.floor(Math.random() * 2000 + 500),
}));

const cardsByNetwork = [
  { name: 'Visa', value: 62, color: '#4f46e5' },
  { name: 'Mastercard', value: 35, color: '#7c3aed' },
  { name: 'Amex', value: 3, color: '#a855f7' },
];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const fadeSlide = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function AdminDashboard() {
  const { data: metricsData, isLoading } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => api.get<{ success: boolean; data: PlatformMetrics }>('/api/admin/metrics'),
    refetchInterval: 30_000,
  });

  const metrics = metricsData?.data?.data;

  const statCards = [
    {
      label: 'Total Users',
      value: metrics?.total_consumers?.toLocaleString() ?? '—',
      icon: Users,
      color: 'from-blue-600/20 to-blue-800/10',
      iconColor: 'text-blue-400',
      change: '+12.4%',
      trend: 'up',
    },
    {
      label: 'Active Cards',
      value: metrics?.active_cards?.toLocaleString() ?? '—',
      icon: CreditCard,
      color: 'from-indigo-600/20 to-indigo-800/10',
      iconColor: 'text-indigo-400',
      change: '+8.2%',
      trend: 'up',
    },
    {
      label: '24h Volume',
      value: metrics?.volume_24h ? formatCurrency(metrics.volume_24h, 'USD') : '—',
      icon: DollarSign,
      color: 'from-emerald-600/20 to-emerald-800/10',
      iconColor: 'text-emerald-400',
      change: '+5.7%',
      trend: 'up',
    },
    {
      label: 'Total Agents',
      value: metrics?.total_agents?.toLocaleString() ?? '—',
      icon: Zap,
      color: 'from-amber-600/20 to-amber-800/10',
      iconColor: 'text-amber-400',
      change: '+3.1%',
      trend: 'up',
    },
    {
      label: 'Cards Today',
      value: metrics?.cards_issued_24h?.toLocaleString() ?? '—',
      icon: ArrowUpRight,
      color: 'from-purple-600/20 to-purple-800/10',
      iconColor: 'text-purple-400',
      change: '+22.5%',
      trend: 'up',
    },
    {
      label: 'Vouchers Redeemed',
      value: metrics?.vouchers_redeemed_24h?.toLocaleString() ?? '—',
      icon: Ticket,
      color: 'from-pink-600/20 to-pink-800/10',
      iconColor: 'text-pink-400',
      change: '+15.3%',
      trend: 'up',
    },
    {
      label: 'Fraud Alerts',
      value: metrics?.critical_fraud_flags?.toLocaleString() ?? '—',
      icon: AlertTriangle,
      color: 'from-red-600/20 to-red-800/10',
      iconColor: 'text-red-400',
      change: metrics?.critical_fraud_flags ? 'CRITICAL' : 'All clear',
      trend: (metrics?.critical_fraud_flags ?? 0) > 0 ? 'down' : 'up',
    },
    {
      label: 'Pool Balance',
      value: metrics?.master_pool_balance ? formatCurrency(metrics.master_pool_balance, 'USD') : '—',
      icon: Shield,
      color: 'from-teal-600/20 to-teal-800/10',
      iconColor: 'text-teal-400',
      change: 'Healthy',
      trend: 'up',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Platform Overview</h1>
          <p className="text-foreground/30 text-sm">Real-time system metrics · Updated every 30s</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium">Live</span>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statCards.map(stat => (
          <motion.div
            key={stat.label}
            variants={fadeSlide}
            className={`
              relative overflow-hidden rounded-2xl p-4
              bg-gradient-to-br ${stat.color}
              border border-foreground/8 hover:border-foreground/15 transition-all
            `}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-xl bg-foreground/5 ${stat.iconColor}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <span className={`text-xs font-medium ${stat.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                {stat.change}
              </span>
            </div>
            {isLoading ? (
              <div className="w-20 h-6 rounded shimmer mb-1" />
            ) : (
              <p className="text-xl font-bold text-foreground font-display">{stat.value}</p>
            )}
            <p className="text-foreground/30 text-xs">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Volume chart */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-foreground font-semibold text-sm">Transaction Volume</h3>
              <p className="text-foreground/30 text-xs">Last 30 days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={volumeData}>
              <defs>
                <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="feesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                interval={6} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                formatter={(v: number) => formatCurrency(v, 'USD')}
              />
              <Area type="monotone" dataKey="volume" stroke="#4f46e5" strokeWidth={2}
                fill="url(#volumeGrad)" name="Volume" />
              <Area type="monotone" dataKey="fees" stroke="#7c3aed" strokeWidth={2}
                fill="url(#feesGrad)" name="Fees" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Cards by network pie */}
        <div className="glass-card p-5">
          <h3 className="text-foreground font-semibold text-sm mb-1">Cards by Network</h3>
          <p className="text-foreground/30 text-xs mb-4">All time</p>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={cardsByNetwork} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  paddingAngle={4} dataKey="value">
                  {cardsByNetwork.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {cardsByNetwork.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-foreground/50 text-xs">{item.name}</span>
                </div>
                <span className="text-foreground text-xs font-semibold">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cards issued bar chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-foreground font-semibold text-sm">Cards Issued Daily</h3>
          <p className="text-foreground/30 text-xs">Last 30 days</p>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={volumeData} barSize={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
              interval={6} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }} />
            <Bar dataKey="cards" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Cards Issued" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* System status */}
      <div className="glass-card p-5">
        <h3 className="text-foreground font-semibold text-sm mb-4">System Status</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Payment Provider', status: 'Operational', healthy: true },
            { label: 'Card Issuance', status: 'Operational', healthy: true },
            { label: 'Webhook Engine', status: 'Operational', healthy: true },
            { label: 'Fraud Detection', status: 'Active', healthy: true },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-foreground/3 border border-foreground/5">
              {item.healthy ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <div>
                <p className="text-foreground text-xs font-medium">{item.label}</p>
                <p className={`text-[10px] ${item.healthy ? 'text-emerald-400' : 'text-red-400'}`}>{item.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
