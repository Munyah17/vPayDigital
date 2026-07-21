import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, Search, Menu, User, Settings, LogOut } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AnnouncementBanner } from './AnnouncementBanner';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuthStore } from '../../stores/authStore';
import { useWalletStore } from '../../stores/walletStore';

export function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { profile, isInitialized, signOut } = useAuthStore();
  const { unreadCount, fetchNotifications, fetchWallets, fetchCards } = useWalletStore();
  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    if (isInitialized && !profile) navigate('/');
  }, [isInitialized, profile, navigate]);

  useEffect(() => {
    if (profile) {
      fetchWallets();
      fetchCards();
      fetchNotifications();
    }
  }, [profile?.id]);

  if (!profile) return null;

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

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
        />
      </div>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 z-50 lg:hidden"
          >
            <Sidebar isCollapsed={false} onToggle={() => setMobileSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-4 border-b border-foreground/5 bg-background/80 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-xl hover:bg-foreground/5 transition-colors"
            >
              <Menu className="w-5 h-5 text-foreground/60" />
            </button>

            {/* Search */}
            <div className="hidden sm:flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 w-64">
              <Search className="w-4 h-4 text-foreground/30 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search transactions, cards..."
                className="bg-transparent text-foreground/60 placeholder:text-foreground/20 text-sm flex-1 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 rounded-xl hover:bg-foreground/5 transition-colors"
            >
              <Bell className="w-5 h-5 text-foreground/60" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Avatar menu */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  aria-label="Account menu"
                  className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center text-white text-sm font-bold shadow-glow-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={10}
                  className="w-56 bg-card border border-foreground/10 rounded-xl shadow-2xl py-1.5 z-50"
                >
                  <div className="px-3 py-2 border-b border-foreground/5">
                    <p className="text-foreground text-sm font-medium truncate">{profile.full_name ?? 'User'}</p>
                    <p className="text-foreground/40 text-xs truncate">{profile.email}</p>
                  </div>
                  <DropdownMenu.Item
                    onSelect={() => navigate('/notifications')}
                    className="flex items-center gap-2.5 px-3 py-2 mt-1 text-sm text-foreground/70 outline-none hover:bg-foreground/5 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Bell className="w-4 h-4" /> Notifications
                    {unreadCount > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => navigate('/profile')}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground/70 outline-none hover:bg-foreground/5 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4" /> Profile
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => navigate('/settings')}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground/70 outline-none hover:bg-foreground/5 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="h-px bg-foreground/5 my-1" />
                  <DropdownMenu.Item
                    disabled={isSigningOut}
                    onSelect={handleSignOut}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 outline-none hover:bg-red-500/10 transition-colors cursor-pointer data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed"
                  >
                    <LogOut className="w-4 h-4" /> {isSigningOut ? 'Signing out…' : 'Sign out'}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        <AnnouncementBanner />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
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
