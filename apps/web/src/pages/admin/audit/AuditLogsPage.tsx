import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, FileText } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatDate } from '@vpay/utils';

interface AuditLog {
  id: string; actor_id: string; action: string; resource_type: string;
  resource_id?: string; changes: Record<string, unknown>; created_at: string;
  profiles?: { full_name: string; email: string };
}

const ACTION_COLOR: Record<string, string> = {
  'user.status': 'text-amber-400',
  'user.role': 'text-indigo-400',
  'user.password': 'text-orange-400',
  'staff.created': 'text-emerald-400',
  'staff.deleted': 'text-red-400',
  'wallet.admin': 'text-purple-400',
  'card.admin': 'text-blue-400',
  'kyc': 'text-teal-400',
};

function actionColor(action: string) {
  const key = Object.keys(ACTION_COLOR).find(k => action.startsWith(k));
  return key ? ACTION_COLOR[key] : 'text-foreground/60';
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, debouncedSearch],
    queryFn: () => api.get('/api/admin/audit-logs', { params: { page, limit: 25, action: debouncedSearch || undefined } }),
  });

  const logs: AuditLog[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    clearTimeout((window as any).__auditSearchTimer);
    (window as any).__auditSearchTimer = setTimeout(() => setDebouncedSearch(v), 400);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Audit Logs</h1>
          <p className="text-foreground/30 text-sm mt-0.5">{total.toLocaleString()} logged actions · immutable record of all admin operations</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 max-w-sm">
        <Search className="w-4 h-4 text-foreground/30" />
        <input value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Filter by action (e.g. wallet, user, kyc)..."
          className="bg-transparent text-foreground text-sm outline-none flex-1 placeholder:text-foreground/20" />
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['When', 'Actor', 'Action', 'Resource', 'Changes'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/3">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-28 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center">
                <FileText className="w-8 h-8 text-foreground/10 mx-auto mb-2" />
                <p className="text-foreground/30 text-sm">No audit logs found</p>
              </td></tr>
            ) : logs.map(log => (
              <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-foreground/2 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-foreground/40 text-xs">{formatDate(log.created_at, 'relative')}</span>
                  <p className="text-foreground/20 text-[10px]">{new Date(log.created_at).toLocaleString()}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground text-sm font-medium">{log.profiles?.full_name ?? 'System'}</p>
                  <p className="text-foreground/30 text-xs">{log.profiles?.email ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <code className={`text-xs font-mono ${actionColor(log.action)}`}>{log.action}</code>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/50 text-xs capitalize">{log.resource_type}</span>
                  {log.resource_id && (
                    <p className="text-foreground/20 text-[10px] font-mono truncate max-w-[120px]">{log.resource_id}</p>
                  )}
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <pre className="text-foreground/40 text-[10px] font-mono truncate">
                    {JSON.stringify(log.changes)}
                  </pre>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5">
          <p className="text-foreground/30 text-xs">{total} entries</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Prev</button>
            <span className="px-3 py-1.5 text-foreground/40 text-xs">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 25}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
