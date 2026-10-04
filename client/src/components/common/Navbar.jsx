import React from 'react';

export function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <span className="navbar-icon">🛡️</span>
          <div>
            <h1 className="navbar-title">Multi-Hazard Early Warning System</h1>
            <p className="navbar-subtitle">Real-time Disaster Risk Monitoring & Alerting</p>
          </div>
        </div>
        <div className="navbar-badge">
          <span className="badge-dot"></span> Citizen Portal
        </div>
      </div>
    </header>
  );
}

export default Navbar;
