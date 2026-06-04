import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { VLogoIcon } from '../ui/VLogoIcon';

const NAV_LINKS = [
  { label: 'Features', to: '/#features' },
  { label: 'How it works', to: '/#how-it-works' },
  { label: 'For agents', to: '/#for-agents' },
  { label: 'About', to: '/about' },
];

export function LandingNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between
                   px-4 sm:px-6 lg:px-10 h-14 sm:h-16
                   bg-[#0a0a16]/90 backdrop-blur-xl border-b border-white/[0.06]"
      >
        {/* Logo */}
        <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 flex-shrink-0">
          <VLogoIcon className="w-7" />
          <span className="font-display font-bold text-white text-base tracking-tight">vPay</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          {NAV_LINKS.map((item) => {
            const isActive = !item.to.includes('#') && pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`transition-colors duration-200 ${
                  isActive ? 'text-white' : 'text-white/45 hover:text-white/80'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2">
          <Link to="/login" className="btn-ghost text-xs py-1.5 px-4">Sign in</Link>
          <Link to="/auth/register" className="btn-brand text-xs py-1.5 px-4">Get started</Link>
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed top-14 sm:top-16 inset-x-0 z-40 md:hidden
                       bg-[#0d0d1e]/98 backdrop-blur-xl border-b border-white/[0.06]"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="px-3 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/[0.05] text-sm font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-white/[0.06] mt-2 pt-3 flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="btn-ghost text-sm py-2.5 text-center"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth/register"
                  onClick={() => setOpen(false)}
                  className="btn-brand text-sm py-2.5 text-center"
                >
                  Get started free
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
