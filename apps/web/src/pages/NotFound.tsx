import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a16] flex items-center justify-center px-4">
      <div className="glass-card p-8 max-w-md w-full text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-amber-500/20 items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="font-display font-bold text-white text-2xl mb-1">Page not found</h1>
        <p className="text-white/40 text-sm mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/dashboard" className="btn-brand inline-flex items-center gap-2 py-3 px-5">
          <Home className="w-4 h-4" /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
