import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface RoleGuardProps {
  role: 'admin' | 'user';
  children: React.ReactNode;
}

export function RoleGuard({ role, children }: RoleGuardProps) {
  const { user } = useAuthStore();

  if (user?.role !== role) {
    const redirectPath = user?.role === 'admin' ? '/admin' : '/user';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
