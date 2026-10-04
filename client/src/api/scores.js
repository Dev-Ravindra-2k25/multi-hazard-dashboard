import { fetchClient } from './client.js';

export async function getRegionScore(regionId) {
  return await fetchClient(`/regions/${regionId}/score`);
}

export async function getRegionHistory(regionId, from = '', to = '') {
  let query = '';
  const params = [];
  if (from) params.push(`from=${encodeURIComponent(from)}`);
  if (to) params.push(`to=${encodeURIComponent(to)}`);
  if (params.length > 0) query = `?${params.join('&')}`;

  return await fetchClient(`/regions/${regionId}/history${query}`);
}
