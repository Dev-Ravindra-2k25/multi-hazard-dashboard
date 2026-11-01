import { fetchClient } from './client.js';

/**
 * Fetch or lazily generate and cache plain-language explanation for a score.
 * Public endpoint.
 * 
 * @param {string} scoreId
 * @returns {Promise<{ explanation: string }>}
 */
export async function getAiExplanation(scoreId) {
  return await fetchClient(`/ai/explain/${scoreId}`, {
    method: 'POST'
  });
}

/**
 * Request an AI-generated draft alert for a region.
 * Admin only.
 * 
 * @param {Object} params
 * @param {string} params.regionId
 * @param {'calm'|'urgent'|'formal'} params.tone
 * @param {'en'|'hi'|'ta'|'te'|'bn'|'mr'} params.language
 * @returns {Promise<{ draft: string }>}
 */
export async function draftAiAlert({ regionId, tone, language }) {
  return await fetchClient('/admin/ai/draft-alert', {
    method: 'POST',
    body: JSON.stringify({ regionId, tone, language })
  });
}

export default {
  getAiExplanation,
  draftAiAlert
};
