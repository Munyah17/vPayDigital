import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Send, Download, ArrowUpRight, ArrowDownLeft, Upload, RefreshCw, WifiOff, Smartphone, Building2, Loader2 } from 'lucide-react';
import { WalletCard, WalletCardSkeleton } from '../../components/wallet/WalletCard';
import { useWalletStore } from '../../stores/walletStore';
import { api } from '../../lib/axios';
import { formatCurrency, formatRelativeTime, titleCase } from '@vpay/utils';
import toast from 'react-hot-toast';

export default function Wallet() {
  const { wallets, activeWallet, transactions, isLoading, setActiveWallet, fetchTransactions, fetchWallets } = useWalletStore();
  const [showSend, setShowSend] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [vaInfo, setVaInfo] = useState<{ account_number: string; bank_name: string } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [searchParams] = useSearchParams();
  const actionHandled = useRef(false);

  const loadWallets = async () => {
    setLoadError(false);
    try {
      await fetchWallets();
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    loadWallets();
  }, []);

  const requestVirtualAccount = async () => {
    if (!activeWallet) {
      if (loadError) {
        toast.error('Could not connect to the server. Check that the API is running.');
      } else if (!isLoading) {
        toast.error('No wallet found. Your account may still be setting up.');
      }
      return;
    }
    const toastId = toast.loading('Getting deposit account…');
    try {
      const res = await api.post(`/api/wallets/${activeWallet.id}/virtual-account`);
      setVaInfo((res.data as any).data);
      toast.success('Virtual account ready', { id: toastId });
    } catch (e: any) {
      const isNetworkError = !e.response;
      toast.error(
        isNetworkError
          ? 'Cannot reach server. Check that the API is running and VITE_API_URL is set correctly.'
          : (e?.response?.data?.message ?? e?.response?.data?.error ?? 'Could not assign virtual account'),
        { id: toastId }
      );
    }
  };

  useEffect(() => {
    if (activeWallet) fetchTransactions(activeWallet.id, { limit: 50 });
  }, [activeWallet?.id, fetchTransactions]);

  useEffect(() => {
    if (actionHandled.current) return;
    const action = searchParams.get('action');
    if (action === 'send') { setShowSend(true); actionHandled.current = true; }
    if (action === 'topup' && activeWallet) { setShowTopUp(true); actionHandled.current = true; }
  }, [searchParams, activeWallet?.id]);

  const hasWallets = wallets.length > 0;
  const actionsDisabled = isLoading || !hasWallets;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-foreground text-2xl">Wallet</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTopUp(true)}
            disabled={actionsDisabled}
            title={actionsDisabled ? 'Wallets loading…' : 'Top up wallet'}
            className="btn-ghost text-sm py-2 px-3 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Top up
          </button>
          <button
            onClick={() => setShowSend(true)}
            disabled={actionsDisabled}
            title={actionsDisabled ? 'Wallets loading…' : 'Send money'}
            className="btn-ghost text-sm py-2 px-3 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" /> Send
          </button>
          <Link to="/wallet/payout" className="btn-brand text-sm py-2 px-3 flex items-center gap-1.5">
            <Upload className="w-4 h-4" /> Withdraw
          </Link>
        </div>
      </div>

      {vaInfo && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">Deposit to this account</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-foreground font-display font-bold text-xl tabular-nums">{vaInfo.account_number}</p>
              <p className="text-foreground/40 text-xs">{vaInfo.bank_name}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(vaInfo.account_number); toast.success('Copied'); }}
              className="btn-ghost text-xs py-1.5 px-3"
            >
              Copy
            </button>
          </div>
        </motion.div>
      )}

      <section>
        <h2 className="font-display font-semibold text-foreground text-lg mb-3">Your wallets</h2>

        {loadError && !isLoading ? (
          <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
            <WifiOff className="w-10 h-10 text-foreground/20" />
            <div>
              <p className="text-foreground/60 text-sm font-medium">Could not connect to the server</p>
              <p className="text-foreground/30 text-xs mt-1">
                Make sure the API is running and <span className="font-mono text-foreground/40">VITE_API_URL</span> is correct in your <span className="font-mono text-foreground/40">.env</span>
              </p>
            </div>
            <button onClick={loadWallets} className="btn-ghost text-sm py-2 px-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {isLoading && wallets.length === 0
              ? Array.from({ length: 3 }).map((_, i) => <WalletCardSkeleton key={i} />)
              : wallets.map((w) => (
                  <WalletCard key={w.id} wallet={w} isActive={activeWallet?.id === w.id} onClick={() => setActiveWallet(w)} />
                ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display font-semibold text-foreground text-lg mb-3">Transactions</h2>
        <div className="glass-card overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-foreground/30 text-sm">No transactions yet</div>
          ) : (
            <ul className="divide-y divide-foreground/5">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.direction === 'credit' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {t.direction === 'credit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">{t.description ?? titleCase(t.type)}</p>
                    <p className="text-foreground/40 text-xs">{formatRelativeTime(new Date(t.created_at))} · <span className="font-mono">{t.reference}</span></p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${t.direction === 'credit' ? 'text-emerald-400' : 'text-foreground'}`}>
                      {t.direction === 'credit' ? '+' : '−'}{formatCurrency(t.amount, t.currency)}
                    </p>
                    <p className="text-foreground/30 text-[10px]">{titleCase(t.status)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {showSend && <SendDialog onClose={() => setShowSend(false)} onSuccess={() => { setShowSend(false); fetchWallets(); }} />}
      {showTopUp && (
        <TopUpDialog
          onClose={() => setShowTopUp(false)}
          onBankTransfer={() => { setShowTopUp(false); requestVirtualAccount(); }}
          onEcocashSuccess={() => { setShowTopUp(false); fetchWallets(); }}
        />
      )}
    </div>
  );
}

function TopUpDialog({ onClose, onBankTransfer, onEcocashSuccess }: { onClose: () => void; onBankTransfer: () => void; onEcocashSuccess: () => void }) {
  const { activeWallet } = useWalletStore();
  const [method, setMethod] = useState<'choose' | 'ecocash'>('choose');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Only USD/GBP/ZAR are supported by VitalPay's hosted checkout — EUR
  // wallets fall back to bank transfer instead.
  const ecocashSupported = activeWallet && ['USD', 'GBP', 'ZAR'].includes(activeWallet.currency);

  const submitEcocash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet) return;
    if (!(parseFloat(amount) >= 5)) {
      toast.error('Minimum top up is 5.00');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/wallets/topup/initialize', {
        amount: parseFloat(amount),
        currency: activeWallet.currency,
        payment_method: 'mobile_money',
      });
      const status = (res.data as any)?.data?.status;
      if (status === 'successful') {
        toast.success('Wallet topped up instantly via EcoCash!');
      } else {
        toast.success('EcoCash payment initiated — check your phone to approve.');
      }
      onEcocashSuccess();
    } catch (e: any) {
      const isNetworkError = !e.response;
      toast.error(
        isNetworkError
          ? 'Cannot reach server. Check API connection.'
          : (e?.response?.data?.message ?? e?.response?.data?.error ?? 'Top up failed')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {method === 'choose' ? (
          <>
            <h3 className="font-display font-bold text-white text-lg mb-1">Top up wallet</h3>
            <p className="text-white/50 text-sm mb-4">Choose how you'd like to fund your {activeWallet?.currency ?? ''} wallet</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => ecocashSupported ? setMethod('ecocash') : toast.error('EcoCash isn\'t available for this currency')}
                disabled={!ecocashSupported}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">EcoCash</p>
                  <p className="text-white/40 text-xs">Instant top up via mobile money USSD</p>
                </div>
              </button>
              <button
                type="button"
                onClick={onBankTransfer}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-white/70" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Bank transfer</p>
                  <p className="text-white/40 text-xs">Get a deposit account number</p>
                </div>
              </button>
            </div>
            <button type="button" onClick={onClose} className="btn-ghost w-full py-2.5 text-sm mt-4 text-white/70">Cancel</button>
          </>
        ) : (
          <>
            <h3 className="font-display font-bold text-white text-lg mb-4">Top up via EcoCash</h3>
            <form onSubmit={submitEcocash} className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-1.5">Amount ({activeWallet?.currency ?? 'USD'}) <span className="text-white/30">· 5.00 minimum</span></label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="5" required autoFocus className="input-field text-white placeholder:text-white/30" placeholder="50.00" />
              </div>
              <p className="text-white/30 text-xs">You'll get an EcoCash USSD prompt on your registered number to confirm the payment.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMethod('choose')} className="btn-ghost flex-1 py-3">Back</button>
                <button type="submit" disabled={loading} className="btn-brand flex-1 py-3 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Top up'}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

interface RecipientMatch { email: string; full_name: string; phone_masked: string | null; avatar_url: string | null }

function SendDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { activeWallet } = useWalletStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RecipientMatch | null>(null);
  const [matches, setMatches] = useState<RecipientMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) { setMatches([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<{ success: boolean; data: RecipientMatch[] }>('/api/wallets/recipients/search', { params: { q: query.trim() } });
        setMatches((res.data as any)?.data ?? []);
        setShowResults(true);
      } catch {
        setMatches([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selected]);

  const pick = (m: RecipientMatch) => {
    setSelected(m);
    setQuery(m.full_name ? `${m.full_name} (${m.email})` : m.email);
    setShowResults(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet) return;
    const toEmail = selected?.email ?? query.trim();
    if (!toEmail.includes('@')) { toast.error('Search for a recipient or enter a valid email'); return; }
    if (!(parseFloat(amount) > 0)) {
      toast.error('Enter an amount greater than 0');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/wallets/transfer', {
        to_email: toEmail,
        amount: parseFloat(amount),
        currency: activeWallet.currency,
      });
      toast.success('Sent!');
      onSuccess();
    } catch (e: any) {
      const isNetworkError = !e.response;
      toast.error(
        isNetworkError
          ? 'Cannot reach server. Check API connection.'
          : (e?.response?.data?.message ?? e?.response?.data?.error ?? 'Transfer failed')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* This dialog sits on a fixed dark scrim (bg-black/60) regardless
            of the page's light/dark theme, so its own text must stay a
            fixed white/light color — theme-relative text-foreground goes
            dark in light mode and becomes unreadable against this modal's
            consistently dark blurred surface. */}
        <h3 className="font-display font-bold text-white text-lg mb-4">Send money</h3>
        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <label className="block text-white/70 text-sm mb-1.5">Recipient</label>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
              onFocus={() => matches.length > 0 && setShowResults(true)}
              type="text"
              required
              autoComplete="off"
              className="input-field text-white placeholder:text-white/30"
              placeholder="Search by name, email, or phone"
            />
            {showResults && (query.trim().length >= 2) && !selected && (
              <div className="absolute z-10 mt-1.5 w-full rounded-xl bg-neutral-900 border border-white/10 shadow-xl max-h-56 overflow-y-auto">
                {searching ? (
                  <p className="text-white/40 text-xs px-3 py-3">Searching…</p>
                ) : matches.length === 0 ? (
                  <p className="text-white/40 text-xs px-3 py-3">No matching users — you can still send to an exact email above.</p>
                ) : (
                  matches.map(m => (
                    <button
                      key={m.email}
                      type="button"
                      onClick={() => pick(m)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/10 text-left transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-300 text-xs font-semibold shrink-0">
                        {(m.full_name || m.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{m.full_name || m.email}</p>
                        <p className="text-white/40 text-xs truncate">{m.email}{m.phone_masked ? ` · ${m.phone_masked}` : ''}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-white/70 text-sm mb-1.5">Amount ({activeWallet?.currency ?? 'USD'})</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="0.01" required className="input-field text-white placeholder:text-white/30" placeholder="50.00" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 py-3">Cancel</button>
            <button type="submit" disabled={loading} className="btn-brand flex-1 py-3 flex items-center justify-center gap-2">
              {loading ? <Plus className="w-4 h-4 animate-spin" /> : 'Send'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
