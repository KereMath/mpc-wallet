import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from '@/components/common';
import { ProtectedRoute, RoleGuard } from '@/components/auth';
import { AdminLayout, UserLayout } from '@/components/layout';
import { LoginPage } from '@/pages/auth/Login';
import {
  AdminDashboard,
  SetupPage,
  PresignaturesPage,
  NodesPage,
  UsersPage,
  TransactionsPage as AdminTransactionsPage,
} from '@/pages/admin';
import {
  UserDashboard,
  SendPage,
  ReceivePage,
  HistoryPage,
} from '@/pages/user';
import { useAuthStore } from '@/stores/authStore';

function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleGuard role="admin">
                <AdminLayout />
              </RoleGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="nodes" element={<NodesPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="presignatures" element={<PresignaturesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="transactions" element={<AdminTransactionsPage />} />
        </Route>

        {/* User Routes */}
        <Route
          path="/user"
          element={
            <ProtectedRoute>
              <RoleGuard role="user">
                <UserLayout />
              </RoleGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<UserDashboard />} />
          <Route path="send" element={<SendPage />} />
          <Route path="receive" element={<ReceivePage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>

        {/* Default Redirect */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to={user?.role === 'admin' ? '/admin' : '/user'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-900">404</h1>
                <p className="text-gray-500 mt-2">Page not found</p>
                <a href="/" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
                  Go Home
                </a>
              </div>
            </div>
          }
        />
      </Routes>

      {/* Global Toast Container */}
      <ToastContainer />
    </>
  );
}

export default App;
