/**
 * Pure calculation functions for individual hazard indices and risk bands.
 * All indices return values between 0 and 100.
 */

/**
 * Flood index = 50% rainfall (24h mm capped at 200) + 50% river level (current / danger level).
 */
export function floodIndex(weatherPayload = {}, riverPayload = {}) {
  const rainfall24h = Number(weatherPayload?.rainfall24h) || 0;
  const rainScore = (Math.min(Math.max(rainfall24h, 0), 200) / 200) * 100;

  let riverRatio = 0;
  if (riverPayload?.dangerLevel && riverPayload.dangerLevel > 0) {
    riverRatio = (Number(riverPayload.currentLevel) || 0) / riverPayload.dangerLevel;
  } else if (typeof riverPayload?.ratio === 'number') {
    riverRatio = riverPayload.ratio;
  }

  const riverScore = Math.min(Math.max(riverRatio, 0), 1) * 100;
  const total = 0.5 * rainScore + 0.5 * riverScore;

  return Math.round(Math.min(Math.max(total, 0), 100) * 100) / 100;
}

/**
 * Seismic index = max magnitude within 300 km over 7 days, scaled M2 to M7 -> 0-100, decayed by age.
 */
export function seismicIndex(seismicPayload = {}, referenceDate = new Date()) {
  const earthquakes = Array.isArray(seismicPayload?.earthquakes)
    ? seismicPayload.earthquakes
    : null;

  if (earthquakes && earthquakes.length > 0) {
    let maxDecayedScore = 0;

    for (const q of earthquakes) {
      const mag = Number(q.mag) || 0;
      if (mag <= 2) continue;

      const baseScore = Math.min(((mag - 2) / 5) * 100, 100);
      let decayFactor = 1;

      if (q.time) {
        const quakeTime = new Date(q.time).getTime();
        const refTime = new Date(referenceDate).getTime();
        const ageDays = Math.max(0, (refTime - quakeTime) / (1000 * 60 * 60 * 24));
        // Linear decay over 7 days
        decayFactor = Math.max(0, 1 - ageDays / 7);
      }

      const score = baseScore * decayFactor;
      if (score > maxDecayedScore) {
        maxDecayedScore = score;
      }
    }

    return Math.round(Math.min(Math.max(maxDecayedScore, 0), 100) * 100) / 100;
  }

  // Fallback if earthquakes array is not present but maxMagnitude is available
  const maxMag = Number(seismicPayload?.maxMagnitude) || 0;
  if (maxMag <= 2) return 0;
  const fallbackScore = Math.min(((maxMag - 2) / 5) * 100, 100);

  return Math.round(Math.min(Math.max(fallbackScore, 0), 100) * 100) / 100;
}

/**
 * Cyclone index = wind speed (up to 40 m/s = 50 pts) + low pressure proxy (drop from 1013 hPa = 50 pts).
 */
export function cyclonIndex(weatherPayload = {}) {
  const windSpeed = Number(weatherPayload?.windSpeed) || 0;
  const pressure = Number(weatherPayload?.pressure) || 1013;

  // Wind component: 0 m/s -> 0 pts, 40+ m/s -> 50 pts
  const windScore = Math.min(Math.max(windSpeed, 0) / 40, 1) * 50;

  // Pressure component: 1013 hPa -> 0 pts, drop of 50 hPa (963 hPa) -> 50 pts
  const pressureDrop = Math.max(0, 1013 - pressure);
  const pressureScore = Math.min(pressureDrop / 50, 1) * 50;

  const total = windScore + pressureScore;
  return Math.round(Math.min(Math.max(total, 0), 100) * 100) / 100;
}

// Alias for convenience
export const cycloneIndex = cyclonIndex;

/**
 * Maps composite score (0-100) to risk band:
 * Low 0-25, Moderate 26-50, High 51-75, Severe 76-100.
 */
export function bandFor(score) {
  const val = Number(score) || 0;
  if (val <= 25) return 'Low';
  if (val <= 50) return 'Moderate';
  if (val <= 75) return 'High';
  return 'Severe';
}
