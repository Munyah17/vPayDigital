import { Bell, Check } from 'lucide-react';
import { useWalletStore } from '../../stores/walletStore';
import { formatRelativeTime } from '@vpay/utils';

export default function Notifications() {
  const { notifications, markNotificationRead } = useWalletStore();

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="font-display font-bold text-white text-2xl">Notifications</h1>
      <div className="glass-card overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">You're all caught up</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {notifications.map((n) => (
              <li key={n.id} className={`p-4 flex items-start gap-3 ${!n.read_at ? 'bg-indigo-500/5' : ''}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${!n.read_at ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/40'}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{n.title}</p>
                  <p className="text-white/60 text-sm">{n.body}</p>
                  <p className="text-white/30 text-xs mt-1">{formatRelativeTime(new Date(n.created_at))}</p>
                </div>
                {!n.read_at && (
                  <button onClick={() => markNotificationRead(n.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
