import React from 'react';

export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="error-card">
      <div className="error-header">
        <span className="error-icon">⚠️</span>
        <div>
          <h3>System Notice</h3>
          <p>{message || 'Unable to retrieve data. Please check connection.'}</p>
        </div>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-retry">
          Retry
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
