import React from 'react';
import { getBandConfig } from '../../utils/bands.js';

export function BandBadge({ band }) {
  const config = getBandConfig(band);

  return (
    <span
      className="band-badge"
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.border
      }}
    >
      <span
        className="band-dot"
        style={{ backgroundColor: config.color }}
      />
      {config.name}
    </span>
  );
}

export default BandBadge;
