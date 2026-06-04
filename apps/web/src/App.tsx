import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { useAuthStore } from './stores/authStore';

const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));

const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Transactions = lazy(() => import('./pages/dashboard/Transactions'));
const Notifications = lazy(() => import('./pages/dashboard/Notifications'));

const Cards = lazy(() => import('./pages/cards/Cards'));
const CardDetail = lazy(() => import('./pages/cards/CardDetail'));
const IssueCard = lazy(() => import('./pages/cards/IssueCard'));
const RequestCard = lazy(() => import('./pages/cards/RequestCard'));

const Wallet = lazy(() => import('./pages/wallet/Wallet'));

const Vouchers = lazy(() => import('./pages/vouchers/Vouchers'));
const RedeemVoucher = lazy(() => import('./pages/vouchers/RedeemVoucher'));

const Profile = lazy(() => import('./pages/settings/Profile'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const Help = lazy(() => import('./pages/settings/Help'));
const KycPage = lazy(() => import('./pages/profile/KycPage'));
const PayoutPage = lazy(() => import('./pages/wallet/PayoutPage'));

const AgentIssue = lazy(() => import('./pages/agent/Issue'));
const AgentFloat = lazy(() => import('./pages/agent/Float'));
const AgentCustomers = lazy(() => import('./pages/agent/Customers'));
const AgentAnalytics = lazy(() => import('./pages/agent/Analytics'));

const Landing = lazy(() => import('./pages/landing/Landing'));
const About = lazy(() => import('./pages/landing/About'));
const Pricing = lazy(() => import('./pages/landing/Pricing'));
const Verify = lazy(() => import('./pages/auth/Verify'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a16]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-sm">v</span>
        </div>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isInitialized, profile } = useAuthStore();
  if (!isInitialized) return <PageLoader />;
  if (!profile) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SmartHome() {
  const { isInitialized, profile } = useAuthStore();
  if (!isInitialized) return <PageLoader />;
  if (profile) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public landing — guests see landing, authenticated users go to dashboard */}
            <Route path="/" element={<SmartHome />} />

            {/* Public marketing routes */}
            <Route path="/about" element={<About />} />
            <Route path="/pricing" element={<Pricing />} />

            {/* Public auth routes — /login is the primary entry point */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth/login" element={<Navigate to="/login" replace />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/verify" element={<Verify />} />

            {/* Authenticated app shell — pathless layout so it doesn't conflict with SmartHome at / */}
            <Route element={<AuthGuard><Layout /></AuthGuard>}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="notifications" element={<Notifications />} />

              <Route path="cards" element={<Cards />} />
              <Route path="cards/new" element={<IssueCard />} />
              <Route path="cards/request" element={<RequestCard />} />
              <Route path="cards/:id" element={<CardDetail />} />

              <Route path="wallet" element={<Wallet />} />
              <Route path="wallet/payout" element={<PayoutPage />} />

              <Route path="vouchers" element={<Vouchers />} />
              <Route path="vouchers/redeem" element={<RedeemVoucher />} />

              <Route path="profile" element={<Profile />} />
              <Route path="profile/kyc" element={<KycPage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="help" element={<Help />} />

              <Route path="agent/issue" element={<AgentIssue />} />
              <Route path="agent/float" element={<AgentFloat />} />
              <Route path="agent/customers" element={<AgentCustomers />} />
              <Route path="agent/analytics" element={<AgentAnalytics />} />

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#1a1a2e' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#1a1a2e' } },
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  );
}
