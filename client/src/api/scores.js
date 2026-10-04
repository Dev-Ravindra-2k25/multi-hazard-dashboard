import { fetchClient } from './client.js';

export async function getRegionScore(regionId) {
  return await fetchClient(`/regions/${regionId}/score`);
}
