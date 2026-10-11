import React from 'react';
import BandBadge from '../risk/BandBadge.jsx';
import Loader from '../common/Loader.jsx';
import ErrorMessage from '../common/ErrorMessage.jsx';

export function AlertLog({ alerts = [], regions = [], loading = false, error = null, onRefresh }) {
  const getRegionName = (alertRegionId) => {
    if (!alertRegionId) return 'Unknown Region';
    const id = typeof alertRegionId === 'object' ? alertRegionId._id : alertRegionId;
    const found = regions.find((r) => r._id === id);
    if (found) return found.name;
    if (typeof alertRegionId === 'object' && alertRegionId.name) return alertRegionId.name;
    return id;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="alert-log-card">
      <div className="table-header">
        <div>
          <h3 className="card-title">📜 Alert History & Broadcast Log</h3>
          <p className="card-subtitle">
            Chronological record of automated threshold escalations and administrator advisories
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="btn-refresh"
            title="Refresh alert log"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Log'}
          </button>
        )}
      </div>

      {loading && alerts.length === 0 && <Loader message="Loading alert history..." />}
      {error && <ErrorMessage message={error} onRetry={onRefresh} />}

      {!loading && !error && alerts.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p className="empty-text">No alerts recorded in the system yet.</p>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="table-responsive">
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Region</th>
                <th>Risk Band</th>
                <th>Type</th>
                <th>Issuing Authority</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert._id}>
                  <td className="cell-timestamp">{formatDate(alert.createdAt)}</td>
                  <td className="cell-region font-bold">{getRegionName(alert.regionId)}</td>
                  <td className="cell-band">
                    {alert.band ? (
                      <BandBadge band={alert.band} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="cell-type">
                    <span
                      className={`badge-alert-type ${
                        alert.type === 'auto' ? 'type-auto' : 'type-manual'
                      }`}
                    >
                      {alert.type === 'auto' ? '🤖 Auto' : '👤 Manual'}
                    </span>
                  </td>
                  <td className="cell-issuer">
                    <span className="issuer-tag">{alert.issuedBy || 'system'}</span>
                  </td>
                  <td className="cell-message">{alert.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AlertLog;
