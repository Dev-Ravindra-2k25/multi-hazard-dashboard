import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/common/Navbar.jsx';
import AlertForm from '../../components/alerts/AlertForm.jsx';
import AlertLog from '../../components/alerts/AlertLog.jsx';
import { getAlerts } from '../../api/alerts.js';
import { getRegions } from '../../api/regions.js';

export function Alerts() {
  const [regions, setRegions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [regionsData, alertsData] = await Promise.all([
        getRegions().catch(() => []),
        getAlerts().catch(() => [])
      ]);
      setRegions(regionsData || []);
      setAlerts(alertsData || []);
    } catch (err) {
      setError(err.message || 'Failed to load alert management data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAlertSent = (newAlert) => {
    if (newAlert) {
      setAlerts((prev) => [newAlert, ...prev]);
    } else {
      fetchData();
    }
  };

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content">
        <div className="admin-header">
          <div>
            <h2 className="page-title">🚨 Emergency Alert Center</h2>
            <p className="page-subtitle">
              Issue targeted district emergency advisories & audit automated hazard escalation logs
            </p>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="btn-refresh"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh All'}
          </button>
        </div>

        <div className="admin-alerts-layout">
          {/* Create Alert Form */}
          <AlertForm regions={regions} onAlertSent={handleAlertSent} />

          {/* Historical Alert Log */}
          <AlertLog
            alerts={alerts}
            regions={regions}
            loading={loading}
            error={error}
            onRefresh={fetchData}
          />
        </div>
      </main>

      <footer className="footer">
        <p>Multi-Hazard Early Warning System • Admin Alert Broadcast & Incident Management</p>
      </footer>
    </div>
  );
}

export default Alerts;
