import React from 'react';

export function StaleBadge() {
  return (
    <div className="stale-badge" title="Data source fallback active. Cached observation values shown.">
      <span className="stale-icon">⏳</span>
      <span>Stale Data</span>
    </div>
  );
}

export default StaleBadge;
