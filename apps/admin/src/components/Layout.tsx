import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCog, CreditCard, Ticket,
  Banknote, AlertTriangle, Webhook, Settings, LogOut, Shield,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Users', icon: Users, to: '/users' },
  { label: 'Agents', icon: UserCog, to: '/agents' },
  { label: 'Cards', icon: CreditCard, to: '/cards' },
  { label: 'Vouchers', icon: Ticket, to: '/vouchers' },
  { label: 'Finance', icon: Banknote, to: '/finance' },
  { label: 'Fraud', icon: AlertTriangle, to: '/fraud' },
  { label: 'Webhooks', icon: Webhook, to: '/webhooks' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];

export function Layout() {
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-surface-900/80 backdrop-blur-xl border-r border-white/5 flex flex-col">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 flex items-center justify-center shadow-glow">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-base leading-none">vPay</p>
            <p className="text-white/30 text-[10px] uppercase tracking-wider">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5 border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{profile?.full_name ?? 'Admin'}</p>
              <p className="text-white/40 text-[10px] truncate capitalize">{profile?.role ?? 'admin'}</p>
            </div>
            <button onClick={handleSignOut} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <LogOut className="w-3.5 h-3.5 text-white/40 hover:text-red-400" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
