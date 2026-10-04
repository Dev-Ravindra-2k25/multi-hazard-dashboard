export const BANDS = {
  Low: {
    name: 'Low',
    min: 0,
    max: 25,
    color: '#10b981', // green
    bg: '#ecfdf5',
    border: '#a7f3d0',
    text: '#065f46',
    guidance: 'No active hazard warnings. Maintain general preparedness and stay informed via local news and weather channels.'
  },
  Moderate: {
    name: 'Moderate',
    min: 26,
    max: 50,
    color: '#f59e0b', // yellow/amber
    bg: '#fffbeb',
    border: '#fde68a',
    text: '#92400e',
    guidance: 'Be cautious. Check emergency supplies, inspect drainage around your property, and monitor official weather bulletins.'
  },
  High: {
    name: 'High',
    min: 51,
    max: 75,
    color: '#f97316', // orange
    bg: '#fff7ed',
    border: '#ffedd5',
    text: '#9a3412',
    guidance: 'Be prepared for potential evacuation. Secure loose items, keep emergency kits ready, charge mobile devices, and follow official alerts.'
  },
  Severe: {
    name: 'Severe',
    min: 76,
    max: 100,
    color: '#ef4444', // red
    bg: '#fef2f2',
    border: '#fecaca',
    text: '#991b1b',
    guidance: 'Immediate safety risk! Follow local disaster management evacuation orders immediately, move to designated shelters, and avoid floodwaters.'
  }
};

export function getBandConfig(bandName) {
  return BANDS[bandName] || BANDS.Low;
}

export function getBandForScore(score) {
  const val = Number(score) || 0;
  if (val <= 25) return BANDS.Low;
  if (val <= 50) return BANDS.Moderate;
  if (val <= 75) return BANDS.High;
  return BANDS.Severe;
}
