import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ALLOWED_ROLES = ['STRATEGIC_STAFF', 'EXECUTIVE'];

export default function ExcelExportRoute({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  const role = (user?.role || '').toUpperCase();
  if (!user?.is_superuser && !ALLOWED_ROLES.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
