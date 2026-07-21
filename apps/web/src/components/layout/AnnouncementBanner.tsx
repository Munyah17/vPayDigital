import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/axios';

interface Announcement {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  dismissible: boolean;
}

const STYLES: Record<Announcement['type'], { bg: string; icon: typeof Info }> = {
  info: { bg: 'bg-indigo-600/15 border-indigo-500/25 text-indigo-300', icon: Info },
  warning: { bg: 'bg-amber-600/15 border-amber-500/25 text-amber-300', icon: AlertTriangle },
  success: { bg: 'bg-emerald-600/15 border-emerald-500/25 text-emerald-300', icon: CheckCircle2 },
};

// Site-wide banner managed from Super Admin → Announcements. Dismissal is
// per-browser (localStorage keyed by title+message) so a new announcement
// always shows even if the last one was dismissed.
export function AnnouncementBanner() {
  const { data } = useQuery({
    queryKey: ['announcement-active'],
    queryFn: () => api.get<{ success: boolean; data: Announcement | null }>('/api/announcements/active'),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const announcement = data?.data?.data ?? null;
  const dismissKey = announcement ? `vpay-announcement-dismissed:${announcement.title}:${announcement.message}` : null;
  const [dismissed, setDismissed] = useState(() => (dismissKey ? localStorage.getItem(dismissKey) === '1' : false));

  if (!announcement || (announcement.dismissible && dismissed)) return null;

  const style = STYLES[announcement.type] ?? STYLES.info;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={`border-b px-4 py-2.5 flex items-center gap-2.5 ${style.bg}`}
      >
        <style.icon className="w-4 h-4 flex-shrink-0" />
        <p className="text-sm flex-1 min-w-0">
          <span className="font-semibold">{announcement.title}</span>
          {announcement.message && <span className="opacity-80"> — {announcement.message}</span>}
        </p>
        {announcement.dismissible && (
          <button
            onClick={() => { if (dismissKey) localStorage.setItem(dismissKey, '1'); setDismissed(true); }}
            className="p-1 rounded hover:bg-white/10 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
