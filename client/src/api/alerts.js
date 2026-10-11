import { fetchClient } from './client.js';

/**
 * Fetch alerts with optional filters for regionId and since ISO timestamp.
 */
export async function getAlerts({ regionId, since } = {}) {
  const params = new URLSearchParams();
  if (regionId) params.append('regionId', regionId);
  if (since) params.append('since', since);

  const query = params.toString();
  return await fetchClient(`/alerts${query ? `?${query}` : ''}`);
}

/**
 * Create a manual alert (Admin only).
 */
export async function createAdminAlert(alertData) {
  return await fetchClient('/admin/alerts', {
    method: 'POST',
    body: JSON.stringify(alertData)
  });
}
