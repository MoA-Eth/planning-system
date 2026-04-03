import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DocumentUploadRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const role = (user.role || '').toUpperCase();
  if (role !== 'LEAD_EXECUTIVE_BODY' && role !== 'ADVISOR' && !user.is_superuser) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export default DocumentUploadRoute;
