import React from 'react';
import BandBadge from './BandBadge.jsx';
import StaleBadge from '../common/StaleBadge.jsx';
import { getBandConfig } from '../../utils/bands.js';

export function ScoreCard({ region, score }) {
  const composite = score ? score.composite : 0;
  const band = score ? score.band : 'Low';
  const isStale = score ? score.stale : false;
  const bandConfig = getBandConfig(band);

  const formattedTime = score?.computedAt
    ? new Date(score.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="score-card" style={{ borderColor: bandConfig.color }}>
      <div className="score-card-header">
        <div>
          <h2 className="region-title">{region?.name || 'Selected Region'}</h2>
          {region?.population && (
            <p className="region-meta">
              Population: {Number(region.population).toLocaleString('en-IN')}
            </p>
          )}
        </div>
        <div className="score-card-badges">
          {isStale && <StaleBadge />}
          <BandBadge band={band} />
        </div>
      </div>

      <div className="score-display-container">
        <div className="score-gauge" style={{ color: bandConfig.color }}>
          <span className="score-value">{composite}</span>
          <span className="score-max">/100</span>
        </div>
        <div className="score-info">
          <p className="score-label">Composite Risk Level</p>
          <p className="score-description">
            Weighted composite risk calculated across active flood, seismic, and cyclone indices.
          </p>
          {formattedTime && (
            <p className="score-timestamp">Updated at: {formattedTime}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScoreCard;
