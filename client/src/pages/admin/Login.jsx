import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import { loginAdmin } from '../../api/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const data = await loginAdmin(email, password);
      login(data.token, data.user);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Login failed. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content flex-center">
        <div className="login-card">
          <div className="login-header">
            <span className="login-icon">🔒</span>
            <h2>Admin Portal Authentication</h2>
            <p className="login-subtitle">Sign in to access authority overview & drill-down data</p>
          </div>

          {error && <ErrorMessage message={error} />}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Official Email</label>
              <input
                id="email"
                type="email"
                required
                className="form-input"
                placeholder="admin@hazard.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In as Admin'}
            </button>
          </form>

          <div className="login-footer">
            <p className="hint-text">
              Default Seed Credentials: <code>admin@hazard.gov.in</code> / <code>Admin@123</code>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Login;
