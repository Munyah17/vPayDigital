import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, UserCheck, CreditCard, Webhook,
  ShieldAlert, DollarSign, Settings, LogOut, Bell, Shield,
  ChevronDown, Activity, Ticket, ShieldCheck, LifeBuoy,
  Zap, ExternalLink, UserCog, Wallet, ScrollText, ArrowLeftRight,
  Key, Landmark, Menu
} from 'lucide-react';
import { useAdminStore } from '../../stores/adminStore';
import { ThemeToggle } from '../ui/ThemeToggle';
import type { Profile } from '@vpay/types';

// ─── Navigation structure ─────────────────────────────────────────────────────

const NAV_SUPER_ADMIN_OPERATIONS = [
  { label: 'Issue Card',       icon: CreditCard, to: '/admin/ops/issue-card' },
  { label: 'Issue Voucher',    icon: Zap,        to: '/admin/ops/issue-voucher' },
  { label: 'Wallet Adjust',    icon: Wallet,     to: '/admin/ops/wallets' },
];

// "Business first" — the sidebar leads with running the platform; personal
// use of the product lives in this one small section at the very bottom.
// These open the consumer app in a new tab (it runs its own auth session).
const NAV_CLIENT_ACCESS = [
  { label: 'My Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'My Wallet',    icon: Wallet,          href: '/wallet' },
  { label: 'My Cards',     icon: CreditCard,      href: '/cards' },
];

const NAV_PLATFORM = [
  { label: 'Dashboard',        icon: LayoutDashboard, to: '/admin/dashboard' },
  { label: 'All Transactions', icon: ArrowLeftRight,  to: '/admin/transactions' },
  { label: 'Audit Logs',       icon: ScrollText,      to: '/admin/audit' },
];

const NAV_PEOPLE = [
  { label: 'Users',            icon: Users,      to: '/admin/users' },
  { label: 'Agents',           icon: UserCheck,  to: '/admin/agents' },
  { label: 'Staff',            icon: UserCog,    to: '/admin/staff' },
];

const NAV_PRODUCTS = [
  { label: 'Cards',            icon: CreditCard, to: '/admin/cards' },
  { label: 'Vouchers',         icon: Ticket,     to: '/admin/vouchers' },
];

const NAV_BANKING = [
  { label: 'Banking',          icon: Landmark,   to: '/admin/banking' },
];

const NAV_COMPLIANCE = [
  { label: 'KYC Review',       icon: ShieldCheck, to: '/admin/kyc' },
  { label: 'Fraud & Risk',     icon: ShieldAlert, to: '/admin/fraud' },
  { label: 'Support Tickets',  icon: LifeBuoy,    to: '/admin/support' },
];

const NAV_FINANCE = [
  { label: 'Finance',          icon: DollarSign,  to: '/admin/finance' },
  { label: 'Webhooks',         icon: Webhook,     to: '/admin/webhooks' },
];

const NAV_SYSTEM = [
  { label: 'Settings',         icon: Settings,    to: '/admin/settings' },
];

// Staff only see a reduced set
const NAV_STAFF_MANAGEMENT = [
  { label: 'Dashboard',        icon: LayoutDashboard, to: '/admin/dashboard' },
  { label: 'Users',            icon: Users,           to: '/admin/users' },
  { label: 'Agents',           icon: UserCheck,       to: '/admin/agents' },
];
const NAV_STAFF_COMPLIANCE = [
  { label: 'KYC Review',       icon: ShieldCheck, to: '/admin/kyc' },
  { label: 'Fraud & Risk',     icon: ShieldAlert, to: '/admin/fraud' },
  { label: 'Support Tickets',  icon: LifeBuoy,    to: '/admin/support' },
];
const NAV_STAFF_PRODUCTS = [
  { label: 'Cards',            icon: CreditCard, to: '/admin/cards' },
  { label: 'Vouchers',         icon: Ticket,     to: '/admin/vouchers' },
  { label: 'Issue Card',       icon: CreditCard, to: '/admin/ops/issue-card' },
  { label: 'Issue Voucher',    icon: Zap,        to: '/admin/ops/issue-voucher' },
];

// ─── NavSection component ─────────────────────────────────────────────────────

function NavSection({ label, items, sidebarOpen, activeColor = 'indigo' }: {
  label: string;
  items: { label: string; icon: React.ElementType; to: string }[];
  sidebarOpen: boolean;
  activeColor?: 'indigo' | 'purple';
}) {
  return (
    <>
      {sidebarOpen && (
        <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-foreground/20 font-medium">{label}</p>
      )}
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all
            ${isActive
              ? activeColor === 'purple'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20'
                : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20'
              : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'}
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
    </>
  );
}

// ─── Sidebar panel (shared between the persistent desktop rail and the mobile drawer) ─

function AdminSidebarPanel({ sidebarOpen, onToggle, isSuperAdmin, profile, onSignOut, signingOut }: {
  sidebarOpen: boolean;
  onToggle: () => void;
  isSuperAdmin: boolean;
  profile: Profile | null;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-foreground/5 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-foreground/5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSuperAdmin ? 'bg-purple-600' : 'bg-indigo-600'}`}>
          <Shield className="w-4 h-4 text-foreground" />
        </div>
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-sm truncate">ePay Smart Control</p>
              <p className="text-foreground/30 text-[10px]">{isSuperAdmin ? 'Super Admin' : 'Staff Panel'}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={onToggle} className="ml-auto p-1 rounded hover:bg-foreground/5 flex-shrink-0">
          <motion.div animate={{ rotate: sidebarOpen ? 0 : 180 }}>
            <ChevronDown className="w-4 h-4 text-foreground/30 -rotate-90" />
          </motion.div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {isSuperAdmin ? (
          <>
            {/* Business first: run-the-platform sections lead, manual
                operations/overrides follow, and personal product use sits
                in the small Client Access section at the very bottom. */}
            <NavSection label="Platform" items={NAV_PLATFORM} sidebarOpen={sidebarOpen} />
            <NavSection label="People" items={NAV_PEOPLE} sidebarOpen={sidebarOpen} />
            <NavSection label="Products" items={NAV_PRODUCTS} sidebarOpen={sidebarOpen} />
            <NavSection label="Banking" items={NAV_BANKING} sidebarOpen={sidebarOpen} />
            <NavSection label="Compliance" items={NAV_COMPLIANCE} sidebarOpen={sidebarOpen} />
            <NavSection label="Finance" items={NAV_FINANCE} sidebarOpen={sidebarOpen} />
            <NavSection label="System" items={NAV_SYSTEM} sidebarOpen={sidebarOpen} />
            {sidebarOpen && <div className="h-px bg-foreground/5 mx-1 my-1" />}
            <NavSection label="Manual Operations" items={NAV_SUPER_ADMIN_OPERATIONS} sidebarOpen={sidebarOpen} activeColor="purple" />
            {sidebarOpen && <div className="h-px bg-foreground/5 mx-1 my-1" />}
            {sidebarOpen && (
              <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-foreground/20 font-medium">Client Access</p>
            )}
            {NAV_CLIENT_ACCESS.map(item => (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/30 hover:text-foreground/60 hover:bg-foreground/5">
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span className="truncate flex-1">{item.label}</span>}
                {sidebarOpen && <ExternalLink className="w-3 h-3 text-foreground/15 flex-shrink-0" />}
              </a>
            ))}
          </>
        ) : (
          <>
            <NavSection label="Management" items={NAV_STAFF_MANAGEMENT} sidebarOpen={sidebarOpen} />
            <NavSection label="Compliance" items={NAV_STAFF_COMPLIANCE} sidebarOpen={sidebarOpen} />
            <NavSection label="Products" items={NAV_STAFF_PRODUCTS} sidebarOpen={sidebarOpen} />
            <NavSection label="Banking" items={NAV_BANKING} sidebarOpen={sidebarOpen} />

            {/* Back to consumer app */}
            {sidebarOpen && (
              <a href="/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/20 hover:text-foreground/50 hover:bg-foreground/5 mt-2">
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">Consumer App</span>
              </a>
            )}
          </>
        )}
      </nav>

      {/* Bottom user strip */}
      <div className="px-2 py-3 border-t border-foreground/5">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-foreground/[0.03]">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isSuperAdmin ? 'bg-purple-600' : 'bg-indigo-600'}`}>
            {profile?.full_name?.charAt(0) ?? 'A'}
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <p className="text-foreground text-xs font-medium truncate">{profile?.full_name}</p>
                <p className="text-foreground/30 text-[10px] capitalize">{profile?.role?.replace('_', ' ')}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={onSignOut} disabled={signingOut} className="p-1 rounded hover:bg-foreground/10 flex-shrink-0 disabled:opacity-40" title="Sign out">
            <LogOut className={`w-3.5 h-3.5 text-foreground/30 hover:text-red-400 ${signingOut ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { profile, signOut } = useAdminStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = profile?.role === 'super_admin';

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/admin');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar — persistent, collapsible */}
      <motion.div
        animate={{ width: sidebarOpen ? 224 : 64 }}
        className="hidden lg:block flex-shrink-0"
      >
        <AdminSidebarPanel
          sidebarOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
          isSuperAdmin={isSuperAdmin}
          profile={profile}
          onSignOut={handleSignOut}
          signingOut={isSigningOut}
        />
      </motion.div>

      {/* Mobile sidebar — slide-in drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-[240px] lg:hidden"
          >
            <AdminSidebarPanel
              sidebarOpen
              onToggle={() => setMobileSidebarOpen(false)}
              isSuperAdmin={isSuperAdmin}
              profile={profile}
              onSignOut={handleSignOut}
              signingOut={isSigningOut}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 px-4 lg:px-6 py-4 border-b border-foreground/5 bg-background/90 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-foreground/5 transition-colors flex-shrink-0"
            >
              <Menu className="w-5 h-5 text-foreground/60" />
            </button>
            {isSuperAdmin && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex-shrink-0">
                <Key className="w-3 h-3 text-purple-400" />
                <span className="text-purple-400 text-xs font-medium">Super Admin</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-xs font-medium">System Online</span>
            </div>
            <ThemeToggle />
            <button className="p-2 rounded-xl hover:bg-foreground/5 transition-colors">
              <Bell className="w-5 h-5 text-foreground/40" />
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
              transition={{ duration: 0.18 }}
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
