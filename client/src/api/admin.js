import { fetchClient } from './client.js';

export async function loginAdmin(email, password) {
  return await fetchClient('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function getAdminRegionObservations(regionId) {
  return await fetchClient(`/admin/regions/${regionId}/observations`);
}
