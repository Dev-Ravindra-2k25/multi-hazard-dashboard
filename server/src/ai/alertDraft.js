import llm from './llm.js';

export const VALID_TONES = ['calm', 'urgent', 'formal'];
export const VALID_LANGUAGES = ['en', 'hi', 'ta', 'te', 'bn', 'mr'];

export const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali',
  mr: 'Marathi'
};

export const ALERT_DRAFT_SYSTEM_PROMPT =
  'You are an emergency management alert drafting assistant for authorized civil protection officers. ' +
  'Draft concise, factual emergency alerts based strictly on the provided regional risk data. ' +
  'Do not give instructions beyond safety guidance. ' +
  'Say "unverified" for anything not in the data. ' +
  'Output only the draft alert text itself, with no preamble, markdown headers, or quotes. ' +
  'The draft must not exceed 400 characters.';

/**
 * Builds an alert draft prompt and requests an AI-generated draft text.
 * 
 * @param {Object} params
 * @param {Object} params.region - Region document/object
 * @param {Object} params.score - Latest RiskScore document/object
 * @param {string} params.tone - "calm" | "urgent" | "formal"
 * @param {string} params.language - "en" | "hi" | "ta" | "te" | "bn" | "mr"
 * @returns {Promise<string|null>} - Draft text capped at 400 chars, or null if LLM fails
 */
export async function draftAlert({ region, score, tone, language }) {
  if (!region || !score) return null;

  // Validate enums
  if (!VALID_TONES.includes(tone)) {
    throw new Error(`Invalid tone: ${tone}. Must be one of: ${VALID_TONES.join(', ')}`);
  }

  if (!VALID_LANGUAGES.includes(language)) {
    throw new Error(`Invalid language: ${language}. Must be one of: ${VALID_LANGUAGES.join(', ')}`);
  }

  const langName = LANGUAGE_NAMES[language] || 'English';
  const regionName = region.name || 'Region';
  const band = score.band || 'Low';
  const composite = Number(score.composite ?? 0);
  const floodIdx = Number(score.floodIdx ?? 0);
  const seismicIdx = Number(score.seismicIdx ?? 0);
  const cyclonIdx = Number(score.cyclonIdx ?? 0);

  const prompt = [
    `Emergency Risk Context:`,
    `- Target Region: ${regionName}`,
    `- Current Risk Band: ${band}`,
    `- Composite Risk Score: ${composite}/100`,
    `- Flood Hazard Index: ${floodIdx}/100`,
    `- Seismic Hazard Index: ${seismicIdx}/100`,
    `- Cyclone Hazard Index: ${cyclonIdx}/100`,
    `- Requested Tone: ${tone}`,
    `- Target Language: ${langName} (${language})`,
    ``,
    `Task:`,
    `Draft an official public safety advisory in ${langName} reflecting the ${tone} tone and current ${band} hazard level.`,
    `Do not exceed 400 characters.`
  ].join('\n');

  const text = await llm.generateText({
    system: ALERT_DRAFT_SYSTEM_PROMPT,
    prompt,
    maxTokens: 300
  });

  if (!text) return null;

  // Guarantee strict cap at 400 characters
  return text.trim().slice(0, 400);
}

export default {
  draftAlert,
  VALID_TONES,
  VALID_LANGUAGES,
  LANGUAGE_NAMES,
  ALERT_DRAFT_SYSTEM_PROMPT
};
