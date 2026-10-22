import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminLayout from '@/components/AdminLayout';
import Home from '@/pages/Home';
import Reconciliacao from '@/pages/Reconciliacao';
import Comprovantes from '@/pages/Comprovantes';
import Contracts from '@/pages/Contracts';
import PixKeyHub from '@/pages/PixKeyHub';
import CustomerDirectory from '@/pages/CustomerDirectory';
import Reports from '@/pages/Reports';
import AIAssistant from '@/pages/AIAssistant';
import UserManagement from '@/pages/UserManagement';
import Debtors from '@/pages/Debtors';
import CustomerPortal from '@/pages/CustomerPortal';
import CompleteRegistration from '@/pages/CompleteRegistration';
import ImportPdf from '@/pages/ImportPdf';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Customer portal (public-facing, no admin layout) */}
      <Route path="/portal" element={<CustomerPortal />} />
      <Route path="/completar-cadastro" element={<CompleteRegistration />} />

      {/* Admin routes (protected + layout) */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/reconciliacao" element={<Reconciliacao />} />
          <Route path="/comprovantes" element={<Comprovantes />} />
          <Route path="/contratos" element={<Contracts />} />
          <Route path="/pix" element={<PixKeyHub />} />
          <Route path="/clientes" element={<CustomerDirectory />} />
          <Route path="/relatorios" element={<Reports />} />
          <Route path="/assistente" element={<AIAssistant />} />
          <Route path="/usuarios" element={<UserManagement />} />
          <Route path="/devedores" element={<Debtors />} />
          <Route path="/importar" element={<ImportPdf />} />
        </Route>
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
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
