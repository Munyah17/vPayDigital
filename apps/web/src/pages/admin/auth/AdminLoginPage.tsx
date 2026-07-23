import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Shield, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminStore } from '../../../stores/adminStore';
import toast from 'react-hot-toast';

interface Props {
  portal: 'admin' | 'super-admin';
}

interface LoginForm { email: string; password: string }

const PORTAL_CONFIG = {
  'admin': {
    label: 'Admin Portal',
    sublabel: 'Staff & agent access only',
    accent: 'from-indigo-600 to-indigo-800',
    glow: 'shadow-[0_0_40px_rgba(79,70,229,0.25)]',
    allowedRoles: ['staff', 'agent'],
    denyMsg: 'This portal is for staff and agent accounts only.',
    placeholder: 'staff@epaysmart.live',
  },
  'super-admin': {
    label: 'Super Admin',
    sublabel: 'Master control — authorised personnel only',
    accent: 'from-purple-600 to-pink-700',
    glow: 'shadow-[0_0_40px_rgba(147,51,234,0.3)]',
    allowedRoles: ['super_admin'],
    denyMsg: 'This portal is for super admin accounts only.',
    placeholder: 'admin@epaysmart.live',
  },
};

export default function AdminLoginPage({ portal }: Props) {
  const [loading, setLoading] = useState(false);
  const { initialize } = useAdminStore();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const cfg = PORTAL_CONFIG[portal];

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword(data);
      if (error) throw error;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (!profile || !cfg.allowedRoles.includes(profile.role)) {
        await supabase.auth.signOut();
        toast.error(cfg.denyMsg);
        return;
      }

      await initialize();
      // Agents don't have an AdminLayout section of their own — their
      // tools (issue vouchers, float, customers, analytics) live inside
      // the regular app shell at /agent/*, gated by AgentGuard rather than
      // AdminGuard. Only staff/super_admin land on /admin/dashboard.
      navigate(profile.role === 'agent' ? '/dashboard' : '/admin/dashboard', { replace: true });
      toast.success(`Welcome back, ${profile.full_name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20 bg-gradient-to-br ${cfg.accent}`} />
      <div className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-15 bg-gradient-to-br ${cfg.accent}`} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm relative"
      >
        <div className={`panel p-8 ${cfg.glow}`}>
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${cfg.accent} flex items-center justify-center`}>
              {portal === 'super-admin'
                ? <Lock className="w-7 h-7 text-white" />
                : <Shield className="w-7 h-7 text-white" />}
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-7">
            <h1 className="font-display font-bold text-2xl text-foreground">{cfg.label}</h1>
            <p className="text-foreground/30 text-sm mt-1">{cfg.sublabel}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-foreground/50 text-xs mb-1.5 font-medium">Email</label>
              <input
                {...register('email', { required: true })}
                type="email"
                placeholder={cfg.placeholder}
                autoComplete="email"
                className="input w-full"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">Required</p>}
            </div>

            <div>
              <label className="block text-foreground/50 text-xs mb-1.5 font-medium">Password</label>
              <input
                {...register('password', { required: true })}
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="input w-full"
              />
              {errors.password && <p className="text-red-400 text-xs mt-1">Required</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Portal badge */}
        <p className="text-center text-foreground/15 text-xs mt-4">
          {portal === 'super-admin' ? 'Super Admin portal · IP-logged' : 'Staff portal · ePay Smart Operations'}
        </p>
      </motion.div>
    </div>
  );
}
