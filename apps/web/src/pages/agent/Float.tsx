import { useWalletStore } from '../../stores/walletStore';
import { formatCurrency } from '@vpay/utils';
import { Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function Float() {
  const { wallets } = useWalletStore();
  const floatWallets = wallets.filter((w) => w.wallet_type === 'agent_float');

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="w-7 h-7 text-indigo-400" />
        <h1 className="font-display font-bold text-foreground text-2xl">My float</h1>
      </div>

      {floatWallets.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-foreground/40 text-sm">No float wallets configured yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {floatWallets.map((w) => (
            <div key={w.id} className="glass-card p-5">
              <p className="text-foreground/40 text-xs uppercase tracking-wider">{w.currency} float</p>
              <p className="font-display font-bold text-foreground text-3xl mt-1">{formatCurrency(w.balance, w.currency)}</p>
              <div className="flex items-center gap-3 mt-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-400"><ArrowDownLeft className="w-3 h-3" /> {formatCurrency(w.total_credited, w.currency)}</span>
                <span className="flex items-center gap-1 text-red-400"><ArrowUpRight className="w-3 h-3" /> {formatCurrency(w.total_debited, w.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
