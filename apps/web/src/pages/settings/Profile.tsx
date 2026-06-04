import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Loader2, User, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

interface ProfileForm {
  full_name: string;
  display_name?: string;
  phone?: string;
  nationality?: string;
  date_of_birth?: string;
  address?: string;
}

export default function Profile() {
  const { profile, refreshProfile } = useAuthStore();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileForm>();

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name,
        display_name: profile.display_name ?? '',
        phone: profile.phone ?? '',
        nationality: profile.nationality ?? '',
        date_of_birth: profile.date_of_birth ?? '',
        address: profile.address ?? '',
      });
    }
  }, [profile, reset]);

  const update = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/api/profile', data),
    onSuccess: () => { toast.success('Profile updated'); refreshProfile(); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Update failed'),
  });

  if (!profile) return null;

  const kycBadge = {
    approved: 'badge-active',
    pending: 'badge-pending',
    rejected: 'badge-failed',
    not_submitted: 'badge-inactive',
    expired: 'badge-inactive',
  }[profile.kyc_status] ?? 'badge-inactive';

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="font-display font-bold text-white text-2xl">Profile</h1>

      {/* Avatar + summary */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-white/5">
          <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center text-white text-2xl font-bold shadow-glow flex-shrink-0">
            {profile.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-display font-bold text-lg truncate">{profile.full_name}</p>
            <p className="text-white/40 text-sm truncate">{profile.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="badge-info capitalize">{profile.role}</span>
              <span className={`${kycBadge} capitalize`}>{profile.kyc_status.replace('_', ' ')}</span>
            </div>
          </div>
          {profile.kyc_status !== 'approved' && (
            <button
              onClick={() => navigate('/profile/kyc')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all flex-shrink-0"
            >
              <Shield className="w-3.5 h-3.5" />
              Verify KYC
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Full name <span className="text-red-400">*</span></label>
              <input {...register('full_name', { required: true })} className="input-field" />
              {errors.full_name && <p className="text-red-400 text-xs mt-1">Required</p>}
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Display name</label>
              <input {...register('display_name')} className="input-field" placeholder="How you appear in transfers" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Phone</label>
              <input {...register('phone')} placeholder="+263..." className="input-field" type="tel" />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Nationality</label>
              <input {...register('nationality')} placeholder="e.g. Zimbabwean" className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Date of birth</label>
              <input
                {...register('date_of_birth')}
                type="date"
                className="input-field"
                max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1.5">
                <User className="inline w-3.5 h-3.5 mr-1 opacity-50" />
                Referral code
              </label>
              <input value={profile.referral_code ?? '—'} readOnly className="input-field opacity-50 cursor-default font-mono tracking-widest" />
            </div>
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-1.5">Address</label>
            <textarea
              {...register('address')}
              rows={2}
              placeholder="Street, City, Country"
              className="input-field resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={update.isPending || !isDirty}
              className="btn-brand py-2.5 px-6 flex items-center gap-2 disabled:opacity-40"
            >
              {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
            </button>
            {isDirty && (
              <button type="button" onClick={() => reset()} className="btn-ghost py-2.5 px-4 text-sm">
                Discard
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
