import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye, EyeOff, ArrowRight, Loader2, Chrome,
  CreditCard, Zap, Globe,
} from 'lucide-react';
import { VLogoIcon } from '../../components/ui/VLogoIcon';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type LoginForm = z.infer<typeof loginSchema>;

const FEATURES = [
  { icon: CreditCard, text: 'Instant virtual Visa & Mastercard cards' },
  { icon: Zap,        text: 'Real-time authorisations & decline codes' },
  { icon: Globe,      text: 'Spend across 180+ countries' },
];

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { refreshProfile } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
      await refreshProfile();
      navigate('/dashboard');
      toast.success('Welcome back!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('Invalid login')) {
        toast.error('Invalid email or password');
      } else if (msg.includes('Email not confirmed')) {
        toast.error('Please verify your email first');
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('provider') || msg.includes('400')) {
        toast.error('Google sign-in is not enabled yet. Use email & password.');
      } else {
        toast.error(msg || 'Google sign-in failed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">

      {/* ── Left branding panel (desktop only) ───────────────────────── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] flex-col justify-between
                      relative overflow-hidden p-10 xl:p-16
                      bg-gradient-to-br from-[#0d0d1e] to-[#0a0a16]">
        {/* Background glows */}
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full
                        bg-indigo-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-[400px] h-[400px] rounded-full
                        bg-purple-700/20 blur-3xl pointer-events-none" />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)',
            backgroundSize: '52px 52px',
          }} />

        {/* Top: logo */}
        <Link to="/" className="flex items-center gap-2.5 relative z-10 w-fit">
          <VLogoIcon className="w-9" />
          <span className="font-display font-bold text-white text-lg">ePayZW</span>
        </Link>

        {/* Middle: headline + features */}
        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display font-bold text-white text-3xl xl:text-4xl leading-tight mb-4"
          >
            Your payments,{' '}
            <span className="text-gradient">everywhere</span>{' '}
            they need to be
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="text-white/45 text-sm xl:text-[0.9375rem] leading-relaxed mb-8 max-w-sm"
          >
            Issue virtual cards instantly, redeem vouchers, and spend internationally — no bank account needed.
          </motion.p>
          <div className="space-y-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.22 + i * 0.07 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-white/60 text-sm">{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom: trust badge */}
        <p className="relative z-10 text-white/20 text-xs">
          256-bit encrypted · PCI-compliant · Zero data sharing
        </p>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center
                      px-4 sm:px-8 py-10 lg:py-0
                      relative overflow-hidden">
        {/* Mobile-only background glow */}
        <div className="lg:hidden absolute -top-32 right-0 w-72 h-72 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
        <div className="lg:hidden absolute bottom-0 left-0 w-64 h-64 rounded-full bg-purple-700/12 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
          className="relative w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8 w-fit mx-auto">
            <VLogoIcon className="w-8" />
            <span className="font-display font-bold text-foreground text-base">ePayZW</span>
          </Link>

          <div className="glass-card p-6 sm:p-8 shadow-glass">
            {/* Header */}
            <div className="mb-6">
              <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground">Welcome back</h1>
              <p className="text-foreground/40 text-sm mt-1">Sign in to your ePayZW account</p>
            </div>

            {/* Google */}
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                         bg-foreground/5 hover:bg-foreground/8 border border-foreground/10 hover:border-foreground/20
                         text-foreground/80 hover:text-foreground text-sm font-medium
                         transition-all duration-200 mb-5 active:scale-[0.98]"
            >
              <Chrome className="w-4 h-4" />
              Continue with Google
            </button>

            <div className="relative flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-foreground/10" />
              <span className="text-foreground/20 text-xs">or email</span>
              <div className="flex-1 h-px bg-foreground/10" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-foreground/60 text-sm mb-1.5 font-medium">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@example.com"
                  className="input-field text-base sm:text-sm"
                  autoComplete="email"
                  inputMode="email"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-foreground/60 text-sm font-medium">Password</label>
                  <Link
                    to="/auth/forgot-password"
                    className="text-purple-400 text-xs hover:text-purple-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input-field pr-12 text-base sm:text-sm"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5
                               text-foreground/30 hover:text-foreground/60 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-brand w-full flex items-center justify-center gap-2 py-3.5 mt-1 text-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <p className="text-center text-foreground/30 text-sm mt-5">
              No account?{' '}
              <Link to="/auth/register" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Create one free
              </Link>
            </p>
          </div>

          <p className="text-center text-foreground/15 text-xs mt-4 lg:hidden">
            256-bit encrypted · PCI-compliant
          </p>
        </motion.div>
      </div>
    </div>
  );
}
