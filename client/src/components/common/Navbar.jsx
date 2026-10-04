import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export function Navbar() {
  const { token, role, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand-link">
          <div className="navbar-brand">
            <span className="navbar-icon">🛡️</span>
            <div>
              <h1 className="navbar-title">Multi-Hazard Early Warning System</h1>
              <p className="navbar-subtitle">Real-time Disaster Risk Monitoring & Alerting</p>
            </div>
          </div>
        </Link>

        <div className="navbar-actions">
          <Link to="/" className="nav-link">
            Citizen View
          </Link>

          {token && role === 'admin' ? (
            <>
              <Link to="/admin" className="nav-link">
                Admin Overview
              </Link>
              <span className="user-email">{user?.email || 'Admin'}</span>
              <button onClick={handleLogout} className="btn-logout">
                Logout
              </button>
            </>
          ) : (
            <Link to="/admin/login" className="btn-admin-login">
              Admin Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
