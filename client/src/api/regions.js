import { fetchClient } from './client.js';

export async function getRegions() {
  return await fetchClient('/regions');
}

export async function getRegion(id) {
  return await fetchClient(`/regions/${id}`);
}

export async function getRegionShelters(id) {
  return await fetchClient(`/regions/${id}/shelters`);
}
