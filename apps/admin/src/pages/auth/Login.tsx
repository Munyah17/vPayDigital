import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Shield, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../stores/adminStore';
import toast from 'react-hot-toast';

interface LoginForm { email: string; password: string }

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { initialize } = useAdminStore();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword(data);
      if (error) throw error;

      // Fetch profile and verify admin role before navigating
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (!profile || !['super_admin', 'staff'].includes(profile.role)) {
        await supabase.auth.signOut();
        toast.error('Admin access only');
        return;
      }

      // Hydrate the admin store so AdminGuard passes immediately
      await initialize();

      navigate('/dashboard', { replace: true });
      toast.success(`Welcome back, ${profile.full_name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="panel p-8 shadow-card">
          <div className="text-center mb-6">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 items-center justify-center shadow-glow mb-4">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display font-bold text-2xl text-white">vPay Admin</h1>
            <p className="text-white/40 text-sm mt-1">Operations console — staff only</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Email</label>
              <input {...register('email', { required: true })} type="email" placeholder="admin@vpay.app" className="input" />
              {errors.email && <p className="text-red-400 text-xs mt-1">Required</p>}
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Password</label>
              <input {...register('password', { required: true })} type="password" placeholder="••••••••" className="input" />
              {errors.password && <p className="text-red-400 text-xs mt-1">Required</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
            </button>
          </form>
        </div>
        <p className="text-center text-white/20 text-xs mt-4">2FA required · IP-restricted in production</p>
      </div>
    </div>
  );
}
