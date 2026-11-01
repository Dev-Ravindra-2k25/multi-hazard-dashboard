import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

/**
 * Universal LLM text generation wrapper.
 * Official SDKs for OpenAI and Google GenAI.
 * 
 * Rules:
 * - Read LLM_API_KEY, LLM_PROVIDER, LLM_MODEL from env
 * - 15 s timeout
 * - max_tokens capped at 300
 * - Errors caught so it returns null instead of throwing
 */
export async function generateText({ system, prompt, maxTokens = 300 } = {}) {
  try {
    const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
    const provider = (process.env.LLM_PROVIDER || 'gemini').trim().toLowerCase();
    const model = process.env.LLM_MODEL || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');

    if (!apiKey) {
      console.warn('[LLM] LLM_API_KEY is not configured; returning null');
      return null;
    }

    if (!prompt || typeof prompt !== 'string') {
      return null;
    }

    // Cap max_tokens strictly at 300
    const requestedTokens = Number(maxTokens);
    const cappedTokens = isNaN(requestedTokens)
      ? 300
      : Math.min(Math.max(1, requestedTokens), 300);

    // Strict 15-second timeout
    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('LLM call timed out after 15 seconds'));
      }, 15000);
      if (timer.unref) timer.unref();
    });

    const llmCall = (async () => {
      if (provider === 'gemini' || provider === 'google') {
        const ai = new GoogleGenAI({ apiKey });
        const geminiModel = model || 'gemini-3.6-flash';
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: prompt,
          config: {
            systemInstruction: system || undefined,
            maxOutputTokens: cappedTokens
          }
        });
        return response.text?.trim() || null;
      } else {
        // Default official OpenAI SDK
        const openai = new OpenAI({ apiKey, timeout: 15000 });
        const messages = [];
        if (system) {
          messages.push({ role: 'system', content: system });
        }
        messages.push({ role: 'user', content: prompt });

        const completion = await openai.chat.completions.create({
          model: model || 'gpt-4o-mini',
          messages,
          max_tokens: cappedTokens
        });

        return completion.choices?.[0]?.message?.content?.trim() || null;
      }
    })();

    const result = await Promise.race([llmCall, timeoutPromise]);
    return result;
  } catch (err) {
    console.error('[LLM] generateText caught error:', err.message);
    return null;
  }
}

const llm = {
  generateText
};

export default llm;
