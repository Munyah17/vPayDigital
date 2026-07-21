import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, CreditCard, Ticket, AlertTriangle,
  DollarSign, Activity, Shield, ArrowUpRight,
  CheckCircle2, XCircle, HelpCircle, Zap
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/adminAxios';
import { formatCurrency } from '@vpay/utils';
import type { PlatformMetrics } from '@vpay/types';

const NETWORK_COLORS: Record<string, string> = {
  visa: '#4f46e5',
  mastercard: '#7c3aed',
  amex: '#a855f7',
  unionpay: '#c084fc',
};

interface DailyVolumePoint { date: string; volume: number; fees: number; cards_issued: number }
interface CardsByNetwork { network: string; count: number }
interface HealthCheck { name: string; status: 'operational' | 'degraded' | 'down' | 'unknown'; detail: string }

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

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['admin-metrics-history'],
    queryFn: () => api.get<{ success: boolean; data: { daily: DailyVolumePoint[]; cards_by_network: CardsByNetwork[] } }>('/api/admin/metrics/history'),
    refetchInterval: 60_000,
  });

  const { data: healthData } = useQuery({
    queryKey: ['admin-system-health'],
    queryFn: () => api.get<{ success: boolean; data: { checks: HealthCheck[]; checked_at: string } }>('/api/admin/system-health'),
    refetchInterval: 30_000,
  });

  const metrics = metricsData?.data?.data;
  const daily = historyData?.data?.data?.daily ?? [];
  const byNetwork = historyData?.data?.data?.cards_by_network ?? [];
  const totalNetworkCards = byNetwork.reduce((sum, n) => sum + n.count, 0);
  const healthChecks = healthData?.data?.data?.checks ?? [];

  const volumeData = daily.map(d => ({
    date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    volume: d.volume,
    fees: d.fees,
    cards: d.cards_issued,
  }));

  // Every badge below is either a raw count (no fabricated comparison) or,
  // for Fraud Alerts, a real derived state — no invented week-over-week
  // percentages. A fake "+12.4%" on a financial platform's own command
  // center is worse than no badge at all.
  const statCards = [
    { label: 'Total Users', value: metrics?.total_consumers?.toLocaleString() ?? '—', icon: Users, color: 'from-blue-600/20 to-blue-800/10', iconColor: 'text-blue-400' },
    { label: 'Active Cards', value: metrics?.active_cards?.toLocaleString() ?? '—', icon: CreditCard, color: 'from-indigo-600/20 to-indigo-800/10', iconColor: 'text-indigo-400' },
    { label: '24h Volume', value: metrics?.volume_24h !== undefined ? formatCurrency(metrics.volume_24h, 'USD') : '—', icon: DollarSign, color: 'from-emerald-600/20 to-emerald-800/10', iconColor: 'text-emerald-400' },
    { label: 'Total Agents', value: metrics?.total_agents?.toLocaleString() ?? '—', icon: Zap, color: 'from-amber-600/20 to-amber-800/10', iconColor: 'text-amber-400' },
    { label: 'New Users (24h)', value: metrics?.new_users_24h?.toLocaleString() ?? '—', icon: ArrowUpRight, color: 'from-purple-600/20 to-purple-800/10', iconColor: 'text-purple-400' },
    { label: 'Vouchers Redeemed (24h)', value: metrics?.vouchers_redeemed_24h?.toLocaleString() ?? '—', icon: Ticket, color: 'from-pink-600/20 to-pink-800/10', iconColor: 'text-pink-400' },
    {
      label: 'Fraud Alerts', value: metrics?.critical_fraud_flags?.toLocaleString() ?? '—', icon: AlertTriangle,
      color: 'from-red-600/20 to-red-800/10', iconColor: 'text-red-400',
      badge: metrics?.critical_fraud_flags ? 'CRITICAL' : 'All clear',
      badgeColor: (metrics?.critical_fraud_flags ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400',
    },
    { label: 'Pool Balance', value: metrics?.master_pool_balance !== undefined ? formatCurrency(metrics.master_pool_balance, 'USD') : '—', icon: Shield, color: 'from-teal-600/20 to-teal-800/10', iconColor: 'text-teal-400' },
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
              {'badge' in stat && (
                <span className={`text-xs font-medium ${stat.badgeColor}`}>{stat.badge}</span>
              )}
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
          <p className="text-foreground/30 text-xs mb-4">Active/frozen cards</p>
          {!historyLoading && byNetwork.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-foreground/20 text-xs">No cards issued yet</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={byNetwork} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                      paddingAngle={4} dataKey="count" nameKey="network">
                      {byNetwork.map((entry, i) => (
                        <Cell key={i} fill={NETWORK_COLORS[entry.network] ?? '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {byNetwork.map(item => (
                  <div key={item.network} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: NETWORK_COLORS[item.network] ?? '#6b7280' }} />
                      <span className="text-foreground/50 text-xs uppercase">{item.network}</span>
                    </div>
                    <span className="text-foreground text-xs font-semibold">
                      {totalNetworkCards ? Math.round((item.count / totalNetworkCards) * 100) : 0}% ({item.count})
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
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

      {/* System status — real checks, see /api/admin/system-health */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-foreground font-semibold text-sm">System Status</h3>
          <Link to="/admin/system-health" className="text-indigo-400 text-xs font-medium hover:text-indigo-300">
            Full health page →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {healthChecks.length === 0 ? (
            <p className="text-foreground/20 text-xs col-span-full">Checking system health…</p>
          ) : healthChecks.map(item => (
            <div key={item.name} className="flex items-center gap-3 p-3 rounded-xl bg-foreground/3 border border-foreground/5">
              {item.status === 'operational' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : item.status === 'unknown' ? (
                <HelpCircle className="w-4 h-4 text-foreground/30 flex-shrink-0" />
              ) : (
                <XCircle className={`w-4 h-4 flex-shrink-0 ${item.status === 'degraded' ? 'text-amber-400' : 'text-red-400'}`} />
              )}
              <div className="min-w-0">
                <p className="text-foreground text-xs font-medium truncate">{item.name}</p>
                <p className={`text-[10px] truncate ${
                  item.status === 'operational' ? 'text-emerald-400'
                  : item.status === 'unknown' ? 'text-foreground/30'
                  : item.status === 'degraded' ? 'text-amber-400' : 'text-red-400'
                }`}>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
