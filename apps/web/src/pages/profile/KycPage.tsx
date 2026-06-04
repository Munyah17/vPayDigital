import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Upload, CheckCircle, Clock, XCircle, AlertTriangle, FileText, ChevronRight } from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/authStore';
import { formatDate } from '@vpay/utils';
import toast from 'react-hot-toast';

type KycDoc = {
  id: string;
  document_type: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  front_url?: string;
  reviewed_at?: string;
  created_at: string;
};

type DocType = { id: string; label: string; description: string; requires_back: boolean; requires_selfie: boolean };

const DOC_TYPES: DocType[] = [
  { id: 'national_id', label: 'National ID', description: 'Government-issued national identity card', requires_back: true, requires_selfie: true },
  { id: 'passport', label: 'Passport', description: 'Valid international passport', requires_back: false, requires_selfie: true },
  { id: 'drivers_license', label: "Driver's License", description: 'Government-issued driver\'s license', requires_back: true, requires_selfie: true },
  { id: 'proof_of_address', label: 'Proof of Address', description: 'Utility bill or bank statement (last 3 months)', requires_back: false, requires_selfie: false },
];

const STATUS_ICON: Record<string, React.ElementType> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-amber-400',
  approved: 'text-emerald-400',
  rejected: 'text-red-400',
};

const STATUS_BG: Record<string, string> = {
  pending: 'bg-amber-500/10 border-amber-500/20',
  approved: 'bg-emerald-500/10 border-emerald-500/20',
  rejected: 'bg-red-500/10 border-red-500/20',
};

export default function KycPage() {
  const { profile, refreshProfile } = useAuthStore();
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState<DocType | null>(null);
  const [form, setForm] = useState({ front_url: '', back_url: '', selfie_url: '', document_number: '', country_of_issue: '', expiry_date: '' });

  const { data } = useQuery({
    queryKey: ['kyc-docs'],
    queryFn: () => api.get<{ success: boolean; data: KycDoc[] }>('/api/kyc'),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post('/api/kyc', {
      document_type: selectedType!.id,
      document_number: form.document_number || undefined,
      front_url: form.front_url,
      back_url: form.back_url || undefined,
      selfie_url: form.selfie_url || undefined,
      country_of_issue: form.country_of_issue || undefined,
      expiry_date: form.expiry_date || undefined,
    }),
    onSuccess: () => {
      toast.success('Document submitted for review');
      qc.invalidateQueries({ queryKey: ['kyc-docs'] });
      refreshProfile();
      setSelectedType(null);
      setForm({ front_url: '', back_url: '', selfie_url: '', document_number: '', country_of_issue: '', expiry_date: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Submission failed'),
  });

  const docs: KycDoc[] = (data as any)?.data?.data ?? [];
  const kycStatus = profile?.kyc_status ?? 'not_submitted';

  const statusBanner = {
    not_submitted: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', text: 'Identity not verified — complete KYC to unlock full platform features.' },
    pending: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', text: 'Documents under review — this usually takes 1-2 business days.' },
    approved: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'Identity verified — all platform features are unlocked.' },
    rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', text: 'Verification rejected — please resubmit the required documents.' },
    expired: { icon: XCircle, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', text: 'KYC expired — please resubmit your documents.' },
  }[kycStatus] ?? { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', text: '' };

  const StatusIcon = statusBanner.icon;

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-indigo-400" />
        <div>
          <h1 className="font-display font-bold text-white text-2xl">Identity Verification</h1>
          <p className="text-white/40 text-sm">KYC · Know Your Customer</p>
        </div>
      </div>

      {/* Status banner */}
      <div className={`flex items-start gap-3 p-4 rounded-xl border ${statusBanner.bg}`}>
        <StatusIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${statusBanner.color}`} />
        <p className={`text-sm ${statusBanner.color}`}>{statusBanner.text}</p>
      </div>

      {/* Submitted docs */}
      {docs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-white font-semibold text-sm">Submitted Documents</h2>
          {docs.map(doc => {
            const Icon = STATUS_ICON[doc.status];
            return (
              <div key={doc.id} className={`flex items-start gap-3 p-4 rounded-xl border ${STATUS_BG[doc.status]}`}>
                <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${STATUS_COLOR[doc.status]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium capitalize">{doc.document_type.replace('_', ' ')}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    Submitted {formatDate(doc.created_at, 'short')}
                    {doc.reviewed_at && ` · Reviewed ${formatDate(doc.reviewed_at, 'short')}`}
                  </p>
                  {doc.rejection_reason && (
                    <p className="text-red-400 text-xs mt-1">Reason: {doc.rejection_reason}</p>
                  )}
                </div>
                <span className={`text-xs capitalize font-medium ${STATUS_COLOR[doc.status]}`}>{doc.status}</span>
              </div>
            );
          })}
        </section>
      )}

      {/* Document type selection */}
      {kycStatus !== 'approved' && (
        <section className="space-y-3">
          <h2 className="text-white font-semibold text-sm">
            {docs.length > 0 ? 'Submit Additional Documents' : 'Choose Document Type'}
          </h2>
          {DOC_TYPES.map(type => {
            const existing = docs.find(d => d.document_type === type.id);
            const isApproved = existing?.status === 'approved';
            return (
              <button key={type.id} onClick={() => !isApproved && setSelectedType(type)}
                disabled={isApproved}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                  isApproved ? 'border-emerald-500/20 bg-emerald-500/5 opacity-60 cursor-default' :
                  selectedType?.id === type.id ? 'border-indigo-500/50 bg-indigo-500/10' :
                  'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                }`}>
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{type.label}</p>
                  <p className="text-white/40 text-xs">{type.description}</p>
                </div>
                {isApproved ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : existing?.status === 'pending' ? (
                  <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-white/30 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </section>
      )}

      {/* Upload form */}
      <AnimatePresence>
        {selectedType && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className="glass-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">{selectedType.label}</h3>
              <button onClick={() => setSelectedType(null)} className="text-white/30 hover:text-white text-xs">Cancel</button>
            </div>

            <div className="space-y-4">
              <UrlField label={`Front of ${selectedType.label}`} hint="Enter the public URL of the document image"
                value={form.front_url} onChange={v => setForm(f => ({ ...f, front_url: v }))} required />

              {selectedType.requires_back && (
                <UrlField label="Back of document" hint="Enter the public URL of the back side"
                  value={form.back_url} onChange={v => setForm(f => ({ ...f, back_url: v }))} />
              )}

              {selectedType.requires_selfie && (
                <UrlField label="Selfie with document" hint="Enter the public URL of your selfie holding the document"
                  value={form.selfie_url} onChange={v => setForm(f => ({ ...f, selfie_url: v }))} />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-sm mb-1.5">Document number</label>
                  <input value={form.document_number} onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))}
                    className="input-field" placeholder="e.g. AB1234567" />
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-1.5">Country of issue</label>
                  <input value={form.country_of_issue} onChange={e => setForm(f => ({ ...f, country_of_issue: e.target.value }))}
                    className="input-field" placeholder="e.g. ZW" maxLength={2} />
                </div>
              </div>

              {selectedType.id !== 'proof_of_address' && (
                <div>
                  <label className="block text-white/60 text-sm mb-1.5">Expiry date</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                    className="input-field" min={new Date().toISOString().split('T')[0]} />
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-blue-400 text-xs">
                Ensure documents are clear, unobstructed, and all information is legible. Documents are reviewed within 1-2 business days.
              </p>
            </div>

            <button onClick={() => submitMutation.mutate()}
              disabled={!form.front_url || submitMutation.isPending}
              className="btn-brand w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40">
              {submitMutation.isPending ? (
                <><Upload className="w-4 h-4 animate-bounce" /> Submitting...</>
              ) : (
                <><Upload className="w-4 h-4" /> Submit for Review</>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UrlField({ label, hint, value, onChange, required }: {
  label: string; hint: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-white/60 text-sm mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} className="input-field"
        placeholder="https://..." type="url" />
      <p className="text-white/30 text-xs mt-1">{hint}</p>
    </div>
  );
}
