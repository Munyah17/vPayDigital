import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { VLogoIcon } from '../../components/ui/VLogoIcon';
import { Link } from 'react-router-dom';

type State = 'verifying' | 'success' | 'error';

export default function Verify() {
  const [state, setState] = useState<State>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');

    if (!token_hash || type !== 'email') {
      // Already verified via magic link auto-exchange — check session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setState('success');
          setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
        } else {
          setState('error');
          setErrorMsg('Verification link is invalid or has expired.');
        }
      });
      return;
    }

    supabase.auth
      .verifyOtp({ token_hash, type: 'email' })
      .then(({ error }) => {
        if (error) {
          setState('error');
          setErrorMsg(error.message);
        } else {
          setState('success');
          setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
        }
      });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-700/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="glass-card p-8 sm:p-10 max-w-md w-full text-center relative"
      >
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <VLogoIcon className="w-8" />
          <span className="font-display font-bold text-foreground text-lg">ePay Smart</span>
        </Link>

        {state === 'verifying' && (
          <>
            <div className="w-16 h-16 rounded-full bg-indigo-500/15 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
            <h2 className="font-display font-bold text-xl text-foreground mb-2">Verifying your email</h2>
            <p className="text-foreground/40 text-sm">Please wait a moment…</p>
          </>
        )}

        {state === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-5"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <h2 className="font-display font-bold text-xl text-foreground mb-2">Email verified!</h2>
            <p className="text-foreground/40 text-sm mb-6">
              Your account is active. Redirecting to your dashboard…
            </p>
            <div className="w-full h-1 rounded-full bg-foreground/5 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: 'linear' }}
              />
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-5">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="font-display font-bold text-xl text-foreground mb-2">Verification failed</h2>
            <p className="text-foreground/40 text-sm mb-6">{errorMsg || 'This link may have expired. Request a new one.'}</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/auth/login')} className="btn-brand w-full py-3 text-sm">
                Go to Sign In
              </button>
              <button onClick={() => navigate('/auth/register')} className="btn-ghost w-full py-3 text-sm">
                Create New Account
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
