import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, ArrowRight, Loader2, CheckCircle2, Lock, KeyRound } from 'lucide-react';
import { VLogoIcon } from '../../components/ui/VLogoIcon';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const schema = z.object({ email: z.string().email('Enter a valid email') });
type Form = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">

      {/* Left branding panel (desktop only) */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] flex-col justify-between
                      relative overflow-hidden p-10 xl:p-16
                      bg-gradient-to-br from-[#0d0d1e] to-[#0a0a16]">
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full
                        bg-indigo-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-[400px] h-[400px] rounded-full
                        bg-purple-700/20 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)',
            backgroundSize: '52px 52px',
          }} />

        <Link to="/" className="flex items-center gap-2.5 relative z-10 w-fit">
          <VLogoIcon className="w-9" />
          <span className="font-display font-bold text-white text-lg">ePayZW</span>
        </Link>

        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display font-bold text-white text-3xl xl:text-4xl leading-tight mb-4"
          >
            Account{' '}
            <span className="text-gradient">security</span>{' '}
            is our priority
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="text-white/45 text-sm xl:text-[0.9375rem] leading-relaxed mb-8 max-w-sm"
          >
            Reset your password securely. We'll send a one-time link to your email — valid for 60 minutes.
          </motion.p>
          <div className="space-y-3">
            {[
              { icon: Lock,     text: 'One-time reset link, expires in 60 min' },
              { icon: Shield,   text: 'End-to-end encrypted reset flow' },
              { icon: KeyRound, text: 'Regain access in under 2 minutes' },
            ].map((f, i) => (
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

        <p className="relative z-10 text-white/20 text-xs">
          256-bit encrypted · PCI-compliant · Zero data sharing
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center
                      px-4 sm:px-8 py-10 lg:py-0
                      relative overflow-hidden">
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

          {sent ? (
            /* ── Success state ─────────────────────────────────── */
            <div className="glass-card p-6 sm:p-8 shadow-glass text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="font-display font-bold text-xl text-foreground mb-2">Check your email</h2>
              <p className="text-foreground/40 text-sm leading-relaxed mb-7">
                We've sent a password reset link to your email address. Click it within 60 minutes to set a new password.
              </p>
              <Link to="/login"
                className="btn-ghost w-full flex items-center justify-center py-3 text-sm">
                Back to Sign In
              </Link>
            </div>
          ) : (
            /* ── Form state ────────────────────────────────────── */
            <div className="glass-card p-6 sm:p-8 shadow-glass">
              <div className="mb-6">
                <div className="inline-flex w-12 h-12 rounded-2xl bg-brand-gradient items-center justify-center shadow-glow mb-4">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground">Reset password</h1>
                <p className="text-foreground/40 text-sm mt-1">
                  Enter your email and we'll send a reset link.
                </p>
              </div>

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

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-brand w-full flex items-center justify-center gap-2 py-3.5 mt-1 text-sm"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Send reset link <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <p className="text-center text-foreground/30 text-sm mt-5">
                Remembered it?{' '}
                <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          <p className="text-center text-foreground/15 text-xs mt-4 lg:hidden">
            256-bit encrypted · PCI-compliant
          </p>
        </motion.div>
      </div>
    </div>
  );
}
