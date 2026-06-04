import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, UserCheck, CreditCard, Webhook,
  ShieldAlert, DollarSign, Settings, LogOut,
  Bell, Search, Shield, ChevronDown, Activity, Ticket, ShieldCheck, LifeBuoy,
  Zap, ExternalLink
} from 'lucide-react';
import { useAdminStore } from '../../stores/adminStore';

const NAV_MANAGEMENT = [
  { label: 'Dashboard',  icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Users',      icon: Users,           to: '/users' },
  { label: 'Agents',     icon: UserCheck,       to: '/agents' },
  { label: 'Cards',      icon: CreditCard,      to: '/cards' },
  { label: 'Vouchers',   icon: Ticket,          to: '/vouchers' },
  { label: 'Finance',    icon: DollarSign,      to: '/finance' },
  { label: 'Fraud',      icon: ShieldAlert,     to: '/fraud' },
  { label: 'KYC Review', icon: ShieldCheck,     to: '/kyc' },
  { label: 'Support',    icon: LifeBuoy,        to: '/support' },
  { label: 'Webhooks',   icon: Webhook,         to: '/webhooks' },
  { label: 'Settings',   icon: Settings,        to: '/settings' },
];

// Super-admin only operations
const NAV_OPERATIONS = [
  { label: 'Issue Voucher', icon: Zap,        to: '/ops/issue-voucher' },
  { label: 'Issue Card',    icon: CreditCard, to: '/ops/issue-card' },
];

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { profile, signOut } = useAdminStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#080812] overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarOpen ? 220 : 64 }}
        className="flex flex-col h-full bg-[#0d0d1e] border-r border-white/5 overflow-hidden"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="font-bold text-white text-sm">vPay Admin</p>
                <p className="text-white/30 text-[10px]">Control Center</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => setSidebarOpen(o => !o)} className="ml-auto p-1 rounded hover:bg-white/5">
            <motion.div animate={{ rotate: sidebarOpen ? 0 : 180 }}>
              <ChevronDown className="w-4 h-4 text-white/30 -rotate-90" />
            </motion.div>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {/* Operations (super_admin only) */}
          {profile?.role === 'super_admin' && (
            <>
              {sidebarOpen && (
                <p className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-widest text-white/20 font-medium">
                  Operations
                </p>
              )}
              {NAV_OPERATIONS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20'
                      : 'text-white/40 hover:text-white hover:bg-white/5'}
                  `}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="truncate">
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              ))}
              {sidebarOpen && <div className="h-px bg-white/5 mx-1 my-1" />}
            </>
          )}

          {/* Management */}
          {sidebarOpen && (
            <p className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-widest text-white/20 font-medium">
              Management
            </p>
          )}
          {NAV_MANAGEMENT.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${isActive ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'text-white/40 hover:text-white hover:bg-white/5'}
              `}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="truncate">
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}

          {/* Quick link to web app */}
          {profile?.role === 'super_admin' && sidebarOpen && (
            <a
              href={import.meta.env.VITE_WEB_URL ?? 'https://vpay-web.vercel.app'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-white/20 hover:text-white hover:bg-white/5 mt-2"
            >
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Open Web App</span>
            </a>
          )}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/3">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {profile?.full_name?.charAt(0) ?? 'A'}
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{profile?.full_name}</p>
                  <p className="text-white/30 text-[10px] capitalize">{profile?.role}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <button onClick={handleSignOut} className="p-1 rounded hover:bg-white/10 flex-shrink-0">
              <LogOut className="w-3.5 h-3.5 text-white/30 hover:text-red-400" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#080812]/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 w-56">
              <Search className="w-4 h-4 text-white/30" />
              <input placeholder="Search users, cards..." className="bg-transparent text-white/50 text-sm outline-none flex-1 placeholder:text-white/20" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-xs font-medium">System Online</span>
            </div>
            <button className="p-2 rounded-xl hover:bg-white/5 transition-colors relative">
              <Bell className="w-5 h-5 text-white/40" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
