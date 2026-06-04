import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="panel p-8 max-w-md text-center">
        <h1 className="font-display font-bold text-white text-2xl">Page not found</h1>
        <p className="text-white/40 text-sm mt-2 mb-5">This admin route doesn't exist</p>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2 px-5">
          <Home className="w-4 h-4" /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
