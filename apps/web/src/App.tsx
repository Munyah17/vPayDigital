import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { AdminLayout } from './components/layout/AdminLayout';
import { useAuthStore } from './stores/authStore';
import { useAdminStore } from './stores/adminStore';
import { useThemeStore } from './stores/themeStore';

// ─── User pages ───────────────────────────────────────────────────────────────
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
const Bills = lazy(() => import('./pages/wallet/Bills'));
const BankingServices = lazy(() => import('./pages/banking/BankingServices'));

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

// ─── Admin pages ──────────────────────────────────────────────────────────────
const AdminLoginPage   = lazy(() => import('./pages/admin/auth/AdminLoginPage'));
const AdminDashboard   = lazy(() => import('./pages/admin/dashboard/AdminDashboard'));
const UsersPage        = lazy(() => import('./pages/admin/users/UsersPage'));
const AgentsPage       = lazy(() => import('./pages/admin/agents/Agents'));
const AdminCardsPage   = lazy(() => import('./pages/admin/cards/AdminCardsPage'));
const WebhooksPage     = lazy(() => import('./pages/admin/webhooks/WebhooksPage'));
const FraudPage        = lazy(() => import('./pages/admin/fraud/FraudPage'));
const FinancePage      = lazy(() => import('./pages/admin/finance/FinancePage'));
const AdminVouchersPage = lazy(() => import('./pages/admin/vouchers/VouchersPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/settings/Settings'));
const KycReviewPage    = lazy(() => import('./pages/admin/kyc/KycReviewPage'));
const SupportPage      = lazy(() => import('./pages/admin/support/SupportPage'));
const IssueVoucherPage = lazy(() => import('./pages/admin/operations/IssueVoucherPage'));
const IssueCardPage    = lazy(() => import('./pages/admin/operations/IssueCardPage'));
const StaffPage        = lazy(() => import('./pages/admin/staff/StaffPage'));
const WalletAdjustPage = lazy(() => import('./pages/admin/wallets/WalletAdjustPage'));
const AuditLogsPage    = lazy(() => import('./pages/admin/audit/AuditLogsPage'));
const AdminTransactionsPage = lazy(() => import('./pages/admin/transactions/TransactionsPage'));
const AdminBankingPage    = lazy(() => import('./pages/admin/banking/AdminBankingPage'));
const SystemHealthPage    = lazy(() => import('./pages/admin/health/SystemHealthPage'));
const AnnouncementsPage   = lazy(() => import('./pages/admin/announcements/AnnouncementsPage'));
const ReportsPage         = lazy(() => import('./pages/admin/reports/ReportsPage'));
const ProvidersPage       = lazy(() => import('./pages/admin/providers/ProvidersPage'));
const ModulesPage         = lazy(() => import('./pages/admin/modules/ModulesPage'));
const EscrowPage          = lazy(() => import('./pages/admin/escrow/EscrowPage'));
const DisputesPage        = lazy(() => import('./pages/admin/disputes/DisputesPage'));
const CommunicationsPage  = lazy(() => import('./pages/admin/communications/CommunicationsPage'));
const MarketingPage       = lazy(() => import('./pages/admin/marketing/MarketingPage'));
const LeadsPage           = lazy(() => import('./pages/admin/leads/LeadsPage'));
const InvoicingPage       = lazy(() => import('./pages/admin/invoicing/InvoicingPage'));
const LoansPage           = lazy(() => import('./pages/admin/loans/LoansPage'));
const PartnersPage        = lazy(() => import('./pages/admin/partners/PartnersPage'));
const TasksPage           = lazy(() => import('./pages/admin/tasks/TasksPage'));
const ApiManagementPage   = lazy(() => import('./pages/admin/apiManagement/ApiManagementPage'));
const AiAssistantPage     = lazy(() => import('./pages/admin/aiAssistant/AiAssistantPage'));
const HrPayrollPage       = lazy(() => import('./pages/admin/hr/HrPayrollPage'));

// ─── Query client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Loaders / Guards ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-sm">v</span>
        </div>
      </div>
    </div>
  );
}

function AdminLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-8 h-8 rounded-lg bg-indigo-600 animate-pulse" />
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isInitialized, profile, user, profileError, refreshProfile } = useAuthStore();
  if (!isInitialized) return <PageLoader />;
  // A logged-in user whose profile fetch failed (network blip, transient DB
  // error) is NOT the same as a logged-out user — redirecting to landing
  // here made a real session look like it had silently logged the user out.
  if (user && !profile && profileError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <p className="text-sm text-muted-foreground">Couldn't load your account. Check your connection and try again.</p>
          <button
            onClick={() => refreshProfile()}
            className="px-4 py-2 rounded-lg bg-brand-gradient text-white text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!profile) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Agent tools (voucher issuance, float, customers, analytics) were only
// ever hidden from consumers via the Sidebar nav — the routes themselves
// had no guard, so a consumer navigating directly to e.g. /agent/issue
// would see the full form UI before any submit failed with a 403 from the
// backend (which was already correctly enforcing this). This closes that
// UX gap; the backend check remains the real security boundary.
function AgentGuard({ children }: { children: React.ReactNode }) {
  const { isInitialized, profile } = useAuthStore();
  if (!isInitialized) return <PageLoader />;
  if (!profile) return <Navigate to="/" replace />;
  if (!['agent', 'super_admin', 'staff'].includes(profile.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, isInitialized } = useAdminStore();
  if (!isInitialized) return <AdminLoader />;
  if (!profile) return <Navigate to="/admin" replace />;
  if (profile.role === 'super_admin' || profile.role === 'staff') return <>{children}</>;
  return <Navigate to="/admin" replace />;
}

function SmartHome() {
  const { isInitialized, profile } = useAuthStore();
  if (!isInitialized) return <PageLoader />;
  if (profile) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { initialize: initUser } = useAuthStore();
  const { initialize: initAdmin } = useAdminStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    initUser();
    initAdmin();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── Public user routes ─────────────────────────────────────── */}
            <Route path="/" element={<SmartHome />} />
            <Route path="/about" element={<About />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/login" element={<Navigate to="/login" replace />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/verify" element={<Verify />} />

            {/* ── Authenticated user shell ───────────────────────────────── */}
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
              <Route path="banking" element={<BankingServices />} />
              <Route path="bills" element={<Bills />} />

              <Route path="vouchers" element={<Vouchers />} />
              <Route path="vouchers/redeem" element={<RedeemVoucher />} />

              <Route path="profile" element={<Profile />} />
              <Route path="profile/kyc" element={<KycPage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="help" element={<Help />} />

              <Route path="agent/issue" element={<AgentGuard><AgentIssue /></AgentGuard>} />
              <Route path="agent/float" element={<AgentGuard><AgentFloat /></AgentGuard>} />
              <Route path="agent/customers" element={<AgentGuard><AgentCustomers /></AgentGuard>} />
              <Route path="agent/analytics" element={<AgentGuard><AgentAnalytics /></AgentGuard>} />

              <Route path="*" element={<NotFound />} />
            </Route>

            {/* ── Admin login pages (hidden — no link from user UI) ──────── */}
            <Route path="/admin" element={<AdminLoginPage portal="admin" />} />
            <Route path="/private" element={<AdminLoginPage portal="super-admin" />} />

            {/* ── Admin dashboard (staff + super_admin) ─────────────────── */}
            <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
              <Route path="dashboard"         element={<AdminDashboard />} />
              <Route path="users"             element={<UsersPage />} />
              <Route path="agents"            element={<AgentsPage />} />
              <Route path="cards"             element={<AdminCardsPage />} />
              <Route path="webhooks"          element={<WebhooksPage />} />
              <Route path="fraud"             element={<FraudPage />} />
              <Route path="finance"           element={<FinancePage />} />
              <Route path="vouchers"          element={<AdminVouchersPage />} />
              <Route path="settings"          element={<AdminSettingsPage />} />
              <Route path="kyc"               element={<KycReviewPage />} />
              <Route path="support"           element={<SupportPage />} />
              <Route path="ops/issue-voucher" element={<IssueVoucherPage />} />
              <Route path="ops/issue-card"    element={<IssueCardPage />} />
              <Route path="staff"             element={<StaffPage />} />
              <Route path="ops/wallets"       element={<WalletAdjustPage />} />
              <Route path="audit"             element={<AuditLogsPage />} />
              <Route path="transactions"      element={<AdminTransactionsPage />} />
              <Route path="banking"           element={<AdminBankingPage />} />
              <Route path="system-health"     element={<SystemHealthPage />} />
              <Route path="announcements"     element={<AnnouncementsPage />} />

              <Route path="reports" element={<ReportsPage />} />
              <Route path="providers" element={<ProvidersPage />} />
              <Route path="modules" element={<ModulesPage />} />
              <Route path="escrow" element={<EscrowPage />} />
              <Route path="disputes" element={<DisputesPage />} />
              <Route path="mass-communication" element={<CommunicationsPage />} />
              <Route path="marketing" element={<MarketingPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="invoicing" element={<InvoicingPage />} />
              <Route path="loans" element={<LoansPage />} />
              <Route path="partners" element={<PartnersPage />} />
              <Route path="ai-assistant" element={<AiAssistantPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="api-management" element={<ApiManagementPage />} />
              <Route path="hr-payroll" element={<HrPayrollPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? '#1a1a2e' : '#ffffff',
            color: isDark ? '#fff' : '#0f1222',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15,18,34,0.08)',
            borderRadius: '12px',
            fontSize: '14px',
            boxShadow: isDark ? undefined : '0 4px 24px rgba(15,18,34,0.08)',
          },
          success: { iconTheme: { primary: '#34d399', secondary: isDark ? '#1a1a2e' : '#ffffff' } },
          error: { iconTheme: { primary: '#f87171', secondary: isDark ? '#1a1a2e' : '#ffffff' } },
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  );
}
