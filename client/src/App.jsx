import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/admin/Login.jsx';
import Overview from './pages/admin/Overview.jsx';
import RegionDetail from './pages/admin/RegionDetail.jsx';

function NotFound() {
  return (
    <main style={{ padding: '3rem 1rem', textAlign: 'center' }}>
      <h2>404 - Page Not Found</h2>
      <p style={{ marginTop: '0.5rem', color: '#64748b' }}>
        The requested page does not exist.
      </p>
    </main>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Citizen Route */}
          <Route path="/" element={<Home />} />

          {/* Admin Auth Route */}
          <Route path="/admin/login" element={<Login />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Overview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/regions/:id"
            element={
              <ProtectedRoute>
                <RegionDetail />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
