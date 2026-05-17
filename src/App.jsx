import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Loans from '@/pages/Loans';
import LoanForm from '@/pages/LoanForm';
import LoanDetail from '@/pages/LoanDetail';
import Borrowers from '@/pages/Borrowers';
import Reports from '@/pages/Reports';
import MasterDirectory from '@/pages/MasterDirectory';
import Admin from '@/pages/Admin';
import Approvals from '@/pages/Approvals';
import Ledger from '@/pages/Ledger';
import Companies from '@/pages/Companies';
import RepaymentAgent from '@/pages/RepaymentAgent';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/loans/new" element={<LoanForm />} />
        <Route path="/loans/:id" element={<LoanDetail />} />
        <Route path="/borrowers" element={<Borrowers />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/directory" element={<MasterDirectory />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/repayment-agent" element={<RepaymentAgent />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App