import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AdminLayout } from './components/layout/AdminLayout';
import { useAdminStore } from './stores/adminStore';

const AdminLoginPage    = lazy(() => import('./pages/auth/AdminLoginPage'));
const PortalSelector    = lazy(() => import('./pages/auth/PortalSelector'));
const AdminDashboard    = lazy(() => import('./pages/dashboard/AdminDashboard'));
const UsersPage         = lazy(() => import('./pages/users/UsersPage'));
const AgentsPage        = lazy(() => import('./pages/agents/Agents'));
const CardsPage         = lazy(() => import('./pages/cards/AdminCardsPage'));
const WebhooksPage      = lazy(() => import('./pages/webhooks/WebhooksPage'));
const FraudPage         = lazy(() => import('./pages/fraud/FraudPage'));
const FinancePage       = lazy(() => import('./pages/finance/FinancePage'));
const VouchersPage      = lazy(() => import('./pages/vouchers/VouchersPage'));
const SettingsPage      = lazy(() => import('./pages/settings/Settings'));
const KycReviewPage     = lazy(() => import('./pages/kyc/KycReviewPage'));
const SupportPage       = lazy(() => import('./pages/support/SupportPage'));
const IssueVoucherPage  = lazy(() => import('./pages/operations/IssueVoucherPage'));
const IssueCardPage     = lazy(() => import('./pages/operations/IssueCardPage'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Loader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#080812]">
      <div className="w-8 h-8 rounded-lg bg-indigo-600 animate-pulse" />
    </div>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, isInitialized } = useAdminStore();
  if (!isInitialized) return <Loader />;
  if (!profile) return <Navigate to="/admin" replace />;
  if (profile.role === 'super_admin') return <>{children}</>;
  if (profile.role === 'staff') return <>{children}</>;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  const { initialize } = useAdminStore();

  useEffect(() => { initialize(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<Loader />}>
          <Routes>
            {/* Portal selector landing */}
            <Route path="/" element={<PortalSelector />} />

            {/* Portal login pages */}
            <Route path="/admin"       element={<AdminLoginPage portal="admin" />} />
            <Route path="/super-admin" element={<AdminLoginPage portal="super-admin" />} />

            {/* Protected dashboard */}
            <Route element={<AdminGuard><AdminLayout /></AdminGuard>}>
              <Route path="dashboard"         element={<AdminDashboard />} />
              <Route path="users"             element={<UsersPage />} />
              <Route path="agents"            element={<AgentsPage />} />
              <Route path="cards"             element={<CardsPage />} />
              <Route path="webhooks"          element={<WebhooksPage />} />
              <Route path="fraud"             element={<FraudPage />} />
              <Route path="finance"           element={<FinancePage />} />
              <Route path="vouchers"          element={<VouchersPage />} />
              <Route path="settings"          element={<SettingsPage />} />
              <Route path="kyc"               element={<KycReviewPage />} />
              <Route path="support"           element={<SupportPage />} />
              <Route path="ops/issue-voucher" element={<IssueVoucherPage />} />
              <Route path="ops/issue-card"    element={<IssueCardPage />} />
              <Route path="*"                 element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#13131f',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
          },
        }}
      />
    </QueryClientProvider>
  );
}
