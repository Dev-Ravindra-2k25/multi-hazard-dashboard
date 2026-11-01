import llm from './llm.js';

export const EXPLAIN_SYSTEM_PROMPT =
  'You are an AI hazard intelligence analyst. Your role is to explain computed regional risk scores in plain, calm, objective language and provide standard safety tips. ' +
  'Do not give instructions beyond safety guidance. ' +
  'Say "unverified" for anything not in the data. ' +
  'Base all statements strictly on the numeric indices provided.';

/**
 * Builds a prompt using only the numbers (region name, floodIdx, seismicIdx, cyclonIdx, composite, band, stale)
 * and generates a 2-3 sentence plain-language explanation plus 3 short safety tips for that band.
 * 
 * @param {Object} riskScore - RiskScore document or object
 * @param {string} [regionName] - Name of the region
 * @returns {Promise<string|null>} - Generated text or null if LLM fails
 */
export async function generateExplanation(riskScore, regionName = '') {
  if (!riskScore) return null;

  const resolvedRegionName =
    regionName ||
    riskScore.regionId?.name ||
    (typeof riskScore.regionId === 'string' ? riskScore.regionId : 'Selected Region');

  const floodIdx = Number(riskScore.floodIdx ?? 0);
  const seismicIdx = Number(riskScore.seismicIdx ?? 0);
  const cyclonIdx = Number(riskScore.cyclonIdx ?? 0);
  const composite = Number(riskScore.composite ?? 0);
  const band = riskScore.band || 'Low';
  const stale = Boolean(riskScore.stale);

  const prompt = [
    `Regional Hazard Risk Data:`,
    `- Region: ${resolvedRegionName}`,
    `- Flood Index: ${floodIdx}/100`,
    `- Seismic Index: ${seismicIdx}/100`,
    `- Cyclone Index: ${cyclonIdx}/100`,
    `- Composite Risk Score: ${composite}/100`,
    `- Risk Band: ${band}`,
    `- Stale Data: ${stale ? 'true' : 'false'}`,
    ``,
    `Instructions:`,
    `Provide a 2-3 sentence plain-language explanation of this risk score, followed by exactly 3 short safety tips appropriate for the ${band} band.`
  ].join('\n');

  return await llm.generateText({
    system: EXPLAIN_SYSTEM_PROMPT,
    prompt,
    maxTokens: 300
  });
}

export default {
  generateExplanation,
  EXPLAIN_SYSTEM_PROMPT
};
