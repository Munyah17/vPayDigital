import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CreditCard, Search, User, ChevronDown, CheckCircle } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import toast from 'react-hot-toast';

const NETWORKS   = ['visa', 'mastercard'] as const;
const CARD_TYPES = ['single_use', 'multi_use', 'disposable', 'time_limited', 'subscription'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'ZAR'] as const;

type Profile = { id: string; full_name: string; email: string; kyc_status: string; status: string };
type IssuedCard = { id: string; masked_pan: string; network: string; currency: string; current_balance: number; card_type: string; status: string };

export default function IssueCardPage() {
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    cardholder_name: '',
    card_type: 'single_use',
    network: 'visa',
    currency: 'USD',
    amount: 25,
  });
  const [lastCard, setLastCard] = useState<IssuedCard | null>(null);

  // Load users for selection
  const { data: usersData } = useQuery({
    queryKey: ['admin-users-search'],
    queryFn: () => api.get('/api/admin/users', { params: { limit: 100 } }),
    staleTime: 60_000,
  });
  const allUsers: Profile[] = (usersData?.data as any)?.data ?? [];
  const filteredUsers = userSearch
    ? allUsers.filter(u =>
        u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()))
    : allUsers;

  // Float balance
  const { data: floatData } = useQuery({
    queryKey: ['admin-float'],
    queryFn: () => api.get('/api/agent/metrics'),
  });
  const floatBalance: number = (floatData?.data as any)?.data?.float_balance ?? 0;
  const floatCurrency: string = (floatData?.data as any)?.data?.currency ?? 'USD';

  const issue = useMutation({
    mutationFn: () => api.post('/api/admin/cards/issue', {
      target_user_id: selectedUser!.id,
      cardholder_name: form.cardholder_name || selectedUser!.full_name,
      card_type: form.card_type,
      network: form.network,
      currency: form.currency,
      amount: form.amount,
    }),
    onSuccess: (res) => {
      const card: IssuedCard = (res.data as any).data;
      setLastCard(card);
      toast.success(`${form.network.toUpperCase()} card issued to ${selectedUser!.full_name}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Card issuance failed'),
  });

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <CreditCard className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Issue Virtual Card</h1>
            <p className="text-foreground/30 text-sm">Issue cards directly to any user from the master float</p>
          </div>
        </div>
        <div className="panel px-4 py-2.5 text-right">
          <p className="text-foreground/30 text-xs">Master Float</p>
          <p className="text-foreground font-bold text-lg font-display">
            {floatCurrency} {floatBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1 — Select user */}
        <div className="panel space-y-4">
          <h2 className="text-foreground font-semibold text-sm flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
            Select Recipient
          </h2>

          <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-foreground/30 flex-shrink-0" />
            <input
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="bg-transparent text-foreground text-sm outline-none flex-1 placeholder:text-foreground/20"
            />
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredUsers.slice(0, 30).map(user => (
              <button
                key={user.id}
                onClick={() => {
                  setSelectedUser(user);
                  setForm(f => ({ ...f, cardholder_name: user.full_name.slice(0, 26).toUpperCase() }));
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                  selectedUser?.id === user.id
                    ? 'bg-indigo-600/20 border border-indigo-500/30'
                    : 'hover:bg-foreground/5 border border-transparent'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-400 text-xs font-bold flex-shrink-0">
                  {user.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs font-medium truncate">{user.full_name}</p>
                  <p className="text-foreground/30 text-[10px] truncate">{user.email}</p>
                </div>
                {selectedUser?.id === user.id && <CheckCircle className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <div className="flex flex-col items-center py-8 text-center">
                <User className="w-6 h-6 text-foreground/10 mb-2" />
                <p className="text-foreground/20 text-sm">No users found</p>
              </div>
            )}
          </div>
        </div>

        {/* Step 2 — Card configuration */}
        <div className="panel space-y-5">
          <h2 className="text-foreground font-semibold text-sm flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
            Card Configuration
          </h2>

          {selectedUser ? (
            <>
              <div className="rounded-xl bg-indigo-600/10 border border-indigo-500/20 px-3 py-2.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-600/40 flex items-center justify-center text-indigo-400 text-xs font-bold flex-shrink-0">
                  {selectedUser.full_name.charAt(0)}
                </div>
                <div>
                  <p className="text-foreground text-xs font-medium">{selectedUser.full_name}</p>
                  <p className="text-foreground/40 text-[10px]">{selectedUser.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-foreground/50 text-xs mb-1.5">Cardholder Name (max 26 chars)</label>
                <input
                  value={form.cardholder_name}
                  onChange={e => setForm(f => ({ ...f, cardholder_name: e.target.value.toUpperCase().slice(0, 26) }))}
                  className="input w-full uppercase font-mono tracking-wider"
                  placeholder="JOHN DOE"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground/50 text-xs mb-1.5">Network</label>
                  <div className="relative">
                    <select value={form.network} onChange={e => setForm(f => ({ ...f, network: e.target.value }))}
                      className="input w-full appearance-none pr-8">
                      {NETWORKS.map(n => <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-foreground/50 text-xs mb-1.5">Card Type</label>
                  <div className="relative">
                    <select value={form.card_type} onChange={e => setForm(f => ({ ...f, card_type: e.target.value }))}
                      className="input w-full appearance-none pr-8">
                      {CARD_TYPES.map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground/50 text-xs mb-1.5">Currency</label>
                  <div className="relative">
                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                      className="input w-full appearance-none pr-8">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-foreground/50 text-xs mb-1.5">Load Amount</label>
                  <input
                    type="number" min={5} max={10000}
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                    className="input w-full"
                  />
                </div>
              </div>

              <button
                onClick={() => issue.mutate()}
                disabled={issue.isPending || !form.cardholder_name}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                {issue.isPending
                  ? <span className="w-4 h-4 rounded-full border-2 border-foreground/30 border-t-white animate-spin" />
                  : <CreditCard className="w-4 h-4" />}
                Issue {form.network.toUpperCase()} Card
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <User className="w-10 h-10 text-foreground/10 mb-3" />
              <p className="text-foreground/20 text-sm">Select a recipient on the left</p>
            </div>
          )}
        </div>
      </div>

      {/* Last issued card result */}
      {lastCard && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel border border-emerald-500/20 bg-emerald-500/5"
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-foreground text-sm font-medium">Card issued successfully</p>
              <p className="text-foreground/40 text-xs mt-0.5">
                {lastCard.network.toUpperCase()} {lastCard.masked_pan ?? '····'} ·
                {lastCard.currency} {Number(lastCard.current_balance).toFixed(2)} ·
                {lastCard.card_type.replace(/_/g, ' ')}
              </p>
            </div>
            <span className="badge-active">Active</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
