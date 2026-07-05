import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CreditCard, Wallet, Ticket, ArrowUpDown,
  User, Settings, LogOut, ChevronLeft, HelpCircle,
  Users, BarChart3, Zap, Landmark
} from 'lucide-react';
import { VLogoIcon } from '../ui/VLogoIcon';
import { useAuthStore } from '../../stores/authStore';
import { useWalletStore } from '../../stores/walletStore';
import type { UserRole } from '@vpay/types';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
  badge?: number;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Cards', icon: CreditCard, to: '/cards' },
  { label: 'Wallet', icon: Wallet, to: '/wallet' },
  { label: 'Banking', icon: Landmark, to: '/banking' },
  { label: 'Vouchers', icon: Ticket, to: '/vouchers' },
  { label: 'Transactions', icon: ArrowUpDown, to: '/transactions' },
  { label: 'Profile', icon: User, to: '/profile' },
];

const agentItems: NavItem[] = [
  { label: 'Issue Vouchers', icon: Zap, to: '/agent/issue', roles: ['agent', 'super_admin', 'staff'] },
  { label: 'My Float', icon: Wallet, to: '/agent/float', roles: ['agent', 'super_admin', 'staff'] },
  { label: 'Customers', icon: Users, to: '/agent/customers', roles: ['agent', 'super_admin', 'staff'] },
  { label: 'Analytics', icon: BarChart3, to: '/agent/analytics', roles: ['agent', 'super_admin', 'staff'] },
];

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { profile, signOut } = useAuthStore();
  const { unreadCount } = useWalletStore();
  const navigate = useNavigate();

  const role = profile?.role ?? 'consumer';
  const isAgent = ['agent', 'super_admin', 'staff'].includes(role);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col h-full bg-sidebar border-r border-foreground/5 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-950/20 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-foreground/5">
        <VLogoIcon className="w-9 flex-shrink-0" />
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="font-display font-bold text-foreground text-lg leading-none">ePay Smart</p>
              <p className="text-foreground/30 text-[10px] font-medium">Zimbabwe Payments</p>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggle}
          className="ml-auto p-1 rounded-lg hover:bg-foreground/5 transition-colors flex-shrink-0"
        >
          <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }}>
            <ChevronLeft className="w-4 h-4 text-foreground/40" />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {/* Main nav */}
        {navItems.map((item) => (
          <SidebarItem key={item.to} item={item} isCollapsed={isCollapsed}
            badge={item.label === 'Notifications' ? unreadCount : undefined} />
        ))}

        {/* Agent section */}
        {isAgent && (
          <>
            <div className="px-2 pt-4 pb-1">
              {!isCollapsed && (
                <p className="text-foreground/20 text-[10px] uppercase tracking-wider font-medium">
                  Agent Tools
                </p>
              )}
              {isCollapsed && <div className="h-px bg-foreground/5 mx-1" />}
            </div>
            {agentItems
              .filter(item => !item.roles || item.roles.includes(role as UserRole))
              .map((item) => (
                <SidebarItem key={item.to} item={item} isCollapsed={isCollapsed} />
              ))}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-4 border-t border-foreground/5 space-y-1">
        <SidebarItem item={{ label: 'Settings', icon: Settings, to: '/settings' }} isCollapsed={isCollapsed} />
        <SidebarItem item={{ label: 'Help', icon: HelpCircle, to: '/help' }} isCollapsed={isCollapsed} />

        {/* User profile */}
        <div className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl mt-2
          bg-foreground/5 border border-foreground/10
        `}>
          <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-foreground text-xs font-medium truncate">{profile?.full_name ?? 'User'}</p>
                <p className="text-foreground/30 text-[10px] truncate capitalize">{profile?.role ?? 'consumer'}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={handleSignOut} disabled={isSigningOut} title="Sign out"
            className="flex-shrink-0 p-1 rounded-lg hover:bg-foreground/10 transition-colors disabled:opacity-40">
            <LogOut className={`w-3.5 h-3.5 text-foreground/40 hover:text-red-400 transition-colors ${isSigningOut ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}

function SidebarItem({ item, isCollapsed, badge }: {
  item: NavItem;
  isCollapsed: boolean;
  badge?: number;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        isActive ? 'nav-item-active flex' : 'nav-item flex'
      }
    >
      <div className="relative flex-shrink-0">
        <Icon className="w-4 h-4" />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-purple-500 text-white text-[9px] font-bold flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <AnimatePresence>
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="truncate"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </NavLink>
  );
}
