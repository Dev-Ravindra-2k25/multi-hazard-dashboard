import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export function ProtectedRoute({ children }) {
  const { token, role } = useAuth();

  if (!token || role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
