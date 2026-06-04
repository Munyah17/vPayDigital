import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, User, Building2 } from 'lucide-react';
import { VLogoIcon } from '../../components/ui/VLogoIcon';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  full_name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirm_password: z.string(),
  role: z.enum(['consumer', 'agent']).default('consumer'),
  referral_code: z.string().optional(),
  terms: z.boolean().refine(v => v, 'You must accept the terms'),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type RegisterForm = z.infer<typeof registerSchema>;

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter',       test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number',                 test: (p: string) => /[0-9]/.test(p) },
];

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [step, setStep]                 = useState<'form' | 'verify'>('form');
  const navigate = useNavigate();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'consumer' },
  });

  const password = watch('password', '');
  const role     = watch('role');

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.full_name, phone: data.phone, role: data.role, referral_code: data.referral_code },
          emailRedirectTo: `${window.location.origin}/auth/verify`,
        },
      });
      if (error) throw error;
      setStep('verify');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      toast.error(msg.includes('already registered') ? 'Email already registered. Try signing in.' : msg);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Email verification screen ─────────────────────────────────────── */
  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-[#0a0a16] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 sm:p-10 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="font-display font-bold text-xl text-white mb-2">Check your email</h2>
          <p className="text-white/40 text-sm mb-7 leading-relaxed">
            We sent a verification link to your email. Click it to activate your account.
          </p>
          <button onClick={() => navigate('/auth/login')} className="btn-ghost w-full py-3">
            Back to Sign In
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Registration form ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#0a0a16] flex flex-col lg:flex-row">

      {/* Left branding strip (desktop) */}
      <div className="hidden lg:flex lg:w-[38%] xl:w-[40%] flex-col justify-between
                      relative overflow-hidden p-10 xl:p-14
                      bg-gradient-to-br from-[#0d0d1e] to-[#0a0a16]">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-purple-700/18 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)',
            backgroundSize: '52px 52px',
          }} />

        <Link to="/" className="flex items-center gap-2.5 relative z-10 w-fit">
          <VLogoIcon className="w-9" />
          <span className="font-display font-bold text-white text-lg">vPay</span>
        </Link>

        <div className="relative z-10">
          <h2 className="font-display font-bold text-white text-2xl xl:text-3xl leading-tight mb-3">
            Join thousands paying{' '}
            <span className="text-gradient">globally</span>
          </h2>
          <p className="text-white/40 text-sm leading-relaxed mb-6">
            Create a free account, load balance with a voucher, and issue your first card in under 60 seconds.
          </p>
          <div className="space-y-2">
            {['Free to join — no membership fee', 'Pay per use, no monthly charges', 'Cards accepted in 180+ countries'].map(t => (
              <div key={t} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                <span className="text-white/50 text-sm">{t}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-white/20 text-xs">256-bit encrypted · PCI-compliant</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center
                      px-4 sm:px-8 py-10 overflow-y-auto">
        <div className="absolute inset-0 lg:hidden pointer-events-none">
          <div className="absolute -top-32 right-0 w-72 h-72 rounded-full bg-indigo-600/12 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-purple-700/10 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
          className="relative w-full max-w-[420px]"
        >
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-7 w-fit mx-auto">
            <VLogoIcon className="w-8" />
            <span className="font-display font-bold text-white text-base">vPay</span>
          </Link>

          <div className="glass-card p-6 sm:p-8 shadow-glass">
            <div className="mb-5">
              <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Create account</h1>
              <p className="text-white/40 text-sm mt-1">Join vPay — it's free</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Role selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl">
                {([
                  { value: 'consumer', label: 'Personal', icon: User },
                  { value: 'agent',    label: 'Agent / Biz', icon: Building2 },
                ] as const).map(r => (
                  <label
                    key={r.value}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg cursor-pointer text-sm font-medium transition-all ${
                      role === r.value
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-glow-sm'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    <input {...register('role')} type="radio" value={r.value} className="sr-only" />
                    <r.icon className="w-3.5 h-3.5" />
                    {r.label}
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-1.5 font-medium">Full Name</label>
                <input {...register('full_name')} type="text" placeholder="John Doe"
                  className="input-field text-base sm:text-sm" autoComplete="name" />
                {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name.message}</p>}
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-1.5 font-medium">Email</label>
                <input {...register('email')} type="email" placeholder="you@example.com"
                  className="input-field text-base sm:text-sm" autoComplete="email" inputMode="email" />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-1.5 font-medium">
                  Phone <span className="text-white/20 font-normal">(optional)</span>
                </label>
                <input {...register('phone')} type="tel" placeholder="+1 234 567 8900"
                  className="input-field text-base sm:text-sm" autoComplete="tel" inputMode="tel" />
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-1.5 font-medium">Password</label>
                <div className="relative">
                  <input {...register('password')} type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    className="input-field pr-12 text-base sm:text-sm" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/60 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {PASSWORD_RULES.map(rule => (
                      <div key={rule.label} className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rule.test(password) ? 'bg-emerald-400' : 'bg-white/20'}`} />
                        <span className={`text-xs ${rule.test(password) ? 'text-emerald-400' : 'text-white/30'}`}>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-1.5 font-medium">Confirm Password</label>
                <input {...register('confirm_password')} type="password" placeholder="Repeat password"
                  className="input-field text-base sm:text-sm" autoComplete="new-password" />
                {errors.confirm_password && <p className="text-red-400 text-xs mt-1">{errors.confirm_password.message}</p>}
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-1.5 font-medium">
                  Referral Code <span className="text-white/20 font-normal">(optional)</span>
                </label>
                <input {...register('referral_code')} type="text" placeholder="VP-XXXX"
                  className="input-field uppercase text-base sm:text-sm" />
              </div>

              <label className="flex items-start gap-3 cursor-pointer py-1">
                <input {...register('terms')} type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded accent-purple-500 flex-shrink-0" />
                <span className="text-white/40 text-xs leading-relaxed">
                  I agree to the{' '}
                  <Link to="/terms" className="text-purple-400 hover:text-purple-300 transition-colors">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-purple-400 hover:text-purple-300 transition-colors">Privacy Policy</Link>
                </span>
              </label>
              {errors.terms && <p className="text-red-400 text-xs -mt-1">{errors.terms.message}</p>}

              <button type="submit" disabled={isLoading}
                className="btn-brand w-full flex items-center justify-center gap-2 py-3.5 text-sm">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>Create Account <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <p className="text-center text-white/30 text-sm mt-5">
              Already have an account?{' '}
              <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
