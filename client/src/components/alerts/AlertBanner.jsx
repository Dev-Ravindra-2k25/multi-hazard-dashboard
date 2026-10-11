import React from 'react';
import { getBandConfig } from '../../utils/bands.js';

export function AlertBanner({ alert, onDismiss, loading = false, error = null }) {
  if (error) {
    return (
      <aside className="alert-banner-container alert-banner-error" role="alert">
        <div className="alert-banner-content">
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">Error checking regional alerts: {error}</span>
        </div>
      </aside>
    );
  }

  if (loading && !alert) {
    return (
      <aside className="alert-banner-container alert-banner-loading" aria-live="polite">
        <div className="alert-banner-content">
          <span className="alert-icon spinner-inline"></span>
          <span className="alert-text">Checking for active emergency alerts...</span>
        </div>
      </aside>
    );
  }

  if (!alert) {
    return null;
  }

  const bandConfig = getBandConfig(alert.band || 'High');
  const isAuto = alert.type === 'auto';
  const formattedTime = alert.createdAt
    ? new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <aside
      className="alert-banner-container"
      role="alert"
      style={{
        backgroundColor: bandConfig.bg,
        borderColor: bandConfig.color,
        color: bandConfig.text
      }}
    >
      <div className="alert-banner-left">
        <span className="alert-pulse-icon" style={{ backgroundColor: bandConfig.color }}>
          ⚠️
        </span>
        <div className="alert-details">
          <div className="alert-tags">
            <span
              className="alert-badge"
              style={{
                backgroundColor: bandConfig.color,
                color: '#ffffff'
              }}
            >
              {isAuto ? '🤖 AUTO WARNING' : '📢 OFFICIAL ADVISORY'}
            </span>
            <span className="alert-band-tag" style={{ borderColor: bandConfig.color }}>
              {bandConfig.name.toUpperCase()} RISK
            </span>
            {formattedTime && <span className="alert-timestamp">Issued {formattedTime}</span>}
          </div>
          <p className="alert-message">{alert.message}</p>
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="alert-dismiss-btn"
          aria-label="Dismiss alert banner"
          title="Dismiss alert"
          style={{ color: bandConfig.text }}
        >
          ✕
        </button>
      )}
    </aside>
  );
}

export default AlertBanner;
