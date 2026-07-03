import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Send, Download, ArrowUpRight, ArrowDownLeft, Upload, RefreshCw, WifiOff } from 'lucide-react';
import { WalletCard, WalletCardSkeleton } from '../../components/wallet/WalletCard';
import { useWalletStore } from '../../stores/walletStore';
import { api } from '../../lib/axios';
import { formatCurrency, formatRelativeTime, titleCase } from '@vpay/utils';
import toast from 'react-hot-toast';

export default function Wallet() {
  const { wallets, activeWallet, transactions, isLoading, setActiveWallet, fetchTransactions, fetchWallets } = useWalletStore();
  const [showSend, setShowSend] = useState(false);
  const [vaInfo, setVaInfo] = useState<{ account_number: string; bank_name: string } | null>(null);
  const [topUpLoading, setTopUpLoading] = useState(false);
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
    setTopUpLoading(true);
    try {
      const res = await api.post(`/api/wallets/${activeWallet.id}/virtual-account`);
      setVaInfo((res.data as any).data);
      toast.success('Virtual account ready');
    } catch (e: any) {
      const isNetworkError = !e.response;
      toast.error(
        isNetworkError
          ? 'Cannot reach server. Check that the API is running and VITE_API_URL is set correctly.'
          : (e?.response?.data?.error ?? 'Could not assign virtual account')
      );
    } finally {
      setTopUpLoading(false);
    }
  };

  useEffect(() => {
    if (activeWallet) fetchTransactions(activeWallet.id, { limit: 50 });
  }, [activeWallet?.id, fetchTransactions]);

  useEffect(() => {
    if (actionHandled.current) return;
    const action = searchParams.get('action');
    if (action === 'send') { setShowSend(true); actionHandled.current = true; }
    if (action === 'topup' && activeWallet) { requestVirtualAccount(); actionHandled.current = true; }
  }, [searchParams, activeWallet?.id]);

  const hasWallets = wallets.length > 0;
  const actionsDisabled = isLoading || !hasWallets;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-foreground text-2xl">Wallet</h1>
        <div className="flex gap-2">
          <button
            onClick={requestVirtualAccount}
            disabled={topUpLoading || actionsDisabled}
            title={actionsDisabled ? 'Wallets loading…' : 'Get deposit account'}
            className="btn-ghost text-sm py-2 px-3 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className={`w-4 h-4 ${topUpLoading ? 'animate-spin' : ''}`} />
            {topUpLoading ? 'Loading…' : 'Top up'}
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
    </div>
  );
}

function SendDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { activeWallet } = useWalletStore();
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet) return;
    setLoading(true);
    try {
      await api.post('/api/wallets/transfer', {
        to_email: email,
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
          : (e?.response?.data?.error ?? 'Transfer failed')
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
        <h3 className="font-display font-bold text-foreground text-lg mb-4">Send money</h3>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Recipient email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="input-field" placeholder="someone@example.com" />
          </div>
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Amount ({activeWallet?.currency ?? 'USD'})</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" required className="input-field" placeholder="50.00" />
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
