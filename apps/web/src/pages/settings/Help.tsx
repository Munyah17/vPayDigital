import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HelpCircle, Mail, MessageSquare, Plus, ChevronDown, ChevronUp, X } from 'lucide-react';
import { api } from '../../lib/axios';
import { formatDate, titleCase } from '@vpay/utils';
import toast from 'react-hot-toast';

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  resolved_at?: string;
};

const STATUS_STYLE: Record<string, string> = {
  open: 'badge-pending',
  in_progress: 'badge-frozen',
  waiting_customer: 'badge-inactive',
  resolved: 'badge-active',
  closed: 'badge-inactive',
};

const CATEGORIES = [
  { id: 'card_issue', label: 'Card Issue' },
  { id: 'payment_failed', label: 'Payment Failed' },
  { id: 'account_access', label: 'Account Access' },
  { id: 'kyc_verification', label: 'KYC Verification' },
  { id: 'payout_issue', label: 'Payout Issue' },
  { id: 'fraud_report', label: 'Report Fraud' },
  { id: 'general_inquiry', label: 'General Inquiry' },
  { id: 'technical_issue', label: 'Technical Issue' },
  { id: 'other', label: 'Other' },
];

export default function Help() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: '', description: '', category: 'general_inquiry', priority: 'normal' });

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => api.get<{ success: boolean; data: Ticket[] }>('/api/support-tickets'),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/support-tickets', form),
    onSuccess: () => {
      toast.success('Ticket submitted — our team will respond shortly');
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      setShowForm(false);
      setForm({ subject: '', description: '', category: 'general_inquiry', priority: 'normal' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to submit ticket'),
  });

  const tickets: Ticket[] = (data as any)?.data?.data ?? [];

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-7 h-7 text-indigo-400" />
          <h1 className="font-display font-bold text-foreground text-2xl">Help & Support</h1>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="btn-brand text-sm py-2 px-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* Quick contact */}
      <div className="grid grid-cols-2 gap-3">
        <a href="mailto:support@epaysmart.live"
          className="glass-card p-4 flex items-center gap-3 hover:border-foreground/20 transition-all rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Mail className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-foreground text-sm font-medium">Email support</p>
            <p className="text-foreground/40 text-xs">support@epaysmart.live</p>
          </div>
        </a>
        <div className="glass-card p-4 flex items-center gap-3 rounded-2xl opacity-50 cursor-not-allowed">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-foreground text-sm font-medium">Live chat</p>
            <p className="text-foreground/40 text-xs">Coming soon</p>
          </div>
        </div>
      </div>

      {/* New ticket form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground font-semibold">New Support Ticket</h2>
            <button onClick={() => setShowForm(false)} className="text-foreground/30 hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-field">
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="input-field">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Subject <span className="text-red-400">*</span></label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="input-field" placeholder="Brief description of your issue" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Description <span className="text-red-400">*</span></label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4}
                className="input-field resize-none" placeholder="Please provide as much detail as possible..." />
            </div>
          </div>
          <button onClick={() => createMutation.mutate()}
            disabled={!form.subject || !form.description || createMutation.isPending}
            className="btn-brand w-full py-3 disabled:opacity-40">
            {createMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </motion.div>
      )}

      {/* Ticket list */}
      <div className="space-y-3">
        {tickets.length > 0 && <h2 className="text-foreground font-semibold text-sm">Your Tickets</h2>}
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-4 rounded-2xl space-y-2">
              <div className="h-5 w-48 rounded shimmer" />
              <div className="h-3 w-32 rounded shimmer" />
            </div>
          ))
        ) : tickets.length === 0 && !showForm ? (
          <div className="glass-card p-12 text-center rounded-2xl">
            <HelpCircle className="w-10 h-10 text-foreground/20 mx-auto mb-3" />
            <p className="text-foreground/40 text-sm">No support tickets yet</p>
            <p className="text-foreground/20 text-xs mt-1">Use the button above to get help</p>
          </div>
        ) : tickets.map(ticket => (
          <div key={ticket.id} className="glass-card rounded-2xl overflow-hidden">
            <button onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
              className="w-full flex items-start gap-4 p-4 text-left hover:bg-foreground/[0.02] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-foreground text-sm font-medium">{ticket.subject}</p>
                  <span className={STATUS_STYLE[ticket.status] ?? 'badge-inactive'}>{titleCase(ticket.status.replace('_', ' '))}</span>
                  <span className="badge-inactive capitalize">{ticket.priority}</span>
                </div>
                <p className="text-foreground/30 text-xs mt-0.5">
                  #{ticket.ticket_number} · {formatDate(ticket.created_at, 'short')} · {titleCase(ticket.category.replace('_', ' '))}
                </p>
              </div>
              {expanded === ticket.id
                ? <ChevronUp className="w-4 h-4 text-foreground/30 flex-shrink-0 mt-0.5" />
                : <ChevronDown className="w-4 h-4 text-foreground/30 flex-shrink-0 mt-0.5" />}
            </button>
            {expanded === ticket.id && (
              <div className="px-4 pb-4 border-t border-foreground/5 pt-3">
                <p className="text-foreground/60 text-sm whitespace-pre-wrap">{ticket.description}</p>
                {ticket.resolved_at && (
                  <p className="text-emerald-400 text-xs mt-2">Resolved {formatDate(ticket.resolved_at, 'short')}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
