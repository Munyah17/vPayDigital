import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock } from 'lucide-react';

export default function PortalSelector() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#080812] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-48 -left-48 w-96 h-96 rounded-full blur-3xl opacity-10 bg-indigo-600" />
      <div className="absolute -bottom-48 -right-48 w-96 h-96 rounded-full blur-3xl opacity-10 bg-purple-600" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 items-center justify-center mb-5">
            <span className="text-white font-display font-bold text-2xl">v</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-white">vPay Admin</h1>
          <p className="text-white/30 text-sm mt-1">Select your access portal</p>
        </div>

        <div className="space-y-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/admin')}
            className="w-full panel p-6 text-left flex items-center gap-5 hover:border-indigo-500/40 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(79,70,229,0.3)]">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-base group-hover:text-indigo-300 transition-colors">Staff Portal</p>
              <p className="text-white/30 text-sm">Operations · Support · KYC review</p>
            </div>
            <span className="badge-info">staff</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/super-admin')}
            className="w-full panel p-6 text-left flex items-center gap-5 hover:border-purple-500/40 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-700 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-base group-hover:text-purple-300 transition-colors">Super Admin</p>
              <p className="text-white/30 text-sm">Full platform control · Finance · Config</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25 font-medium">super_admin</span>
          </motion.button>
        </div>

        <p className="text-center text-white/15 text-xs mt-8">vPay Operations Console · All access is logged</p>
      </motion.div>
    </div>
  );
}
