import mongoose from 'mongoose';
import { RiskScore, Region } from '../models/index.js';
import { generateExplanation } from '../ai/explain.js';
import { draftAlert, VALID_TONES, VALID_LANGUAGES } from '../ai/alertDraft.js';
import { answerCitizenQuestion } from '../ai/assistant.js';

/**
 * POST /api/ai/explain/:scoreId
 * Public endpoint to retrieve or lazily generate and cache plain-language explanation for a score.
 */
export async function explainScore(req, res, next) {
  try {
    const { scoreId } = req.params;

    if (!scoreId || !mongoose.Types.ObjectId.isValid(scoreId)) {
      return res.status(400).json({ error: 'Invalid score ID format' });
    }

    const score = await RiskScore.findById(scoreId).populate('regionId');
    if (!score) {
      return res.status(404).json({ error: 'Risk score not found' });
    }

    // If explanation already stored, return without calling LLM
    if (score.explanation && typeof score.explanation === 'string' && score.explanation.trim().length > 0) {
      return res.status(200).json({ explanation: score.explanation });
    }

    const regionName = score.regionId?.name || 'Selected Region';
    const explanation = await generateExplanation(score, regionName);

    // If LLM fails, return 503 JSON error
    if (!explanation) {
      return res.status(503).json({ error: 'AI explanation service currently unavailable' });
    }

    // Persist cached explanation in RiskScore
    score.explanation = explanation;
    await score.save();

    return res.status(200).json({ explanation });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/ai/draft-alert
 * Admin-only endpoint to draft an emergency alert message based on region's latest score.
 * Does NOT create or dispatch any Alert.
 */
export async function draftAlertHandler(req, res, next) {
  try {
    const { regionId, tone, language } = req.body;

    // Validate regionId
    if (!regionId || !mongoose.Types.ObjectId.isValid(regionId)) {
      return res.status(400).json({ error: 'Invalid or missing region ID' });
    }

    // Validate tone enum
    if (!tone || !VALID_TONES.includes(tone)) {
      return res.status(400).json({
        error: `Invalid tone. Must be one of: ${VALID_TONES.join(', ')}`
      });
    }

    // Validate language enum
    if (!language || !VALID_LANGUAGES.includes(language)) {
      return res.status(400).json({
        error: `Invalid language. Must be one of: ${VALID_LANGUAGES.join(', ')}`
      });
    }

    const region = await Region.findById(regionId);
    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    const latestScore = await RiskScore.findOne({ regionId }).sort({ computedAt: -1 });
    if (!latestScore) {
      return res.status(404).json({ error: 'No risk score found for region' });
    }

    const draft = await draftAlert({
      region,
      score: latestScore,
      tone,
      language
    });

    if (!draft) {
      return res.status(503).json({ error: 'AI alert drafting service currently unavailable' });
    }

    // Output { draft } capped at 400 characters
    return res.status(200).json({
      draft: draft.slice(0, 400)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/ai/assistant
 * Public read-only endpoint for answering citizen hazard questions grounded strictly
 * on the specified region's data.
 */
export async function handleAssistantQuestion(req, res, next) {
  try {
    const { regionId, question } = req.body;

    // 1. Validate regionId ObjectId
    if (!regionId || !mongoose.Types.ObjectId.isValid(regionId)) {
      return res.status(400).json({ error: 'Invalid or missing region ID' });
    }

    // 2. Validate question string & bounds
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length > 300) {
      return res.status(400).json({ error: 'Question exceeds maximum limit of 300 characters' });
    }

    // 3. Verify region exists
    const region = await Region.findById(regionId);
    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    // 4. Generate grounded answer
    const answer = await answerCitizenQuestion({
      regionId,
      question: trimmedQuestion
    });

    if (!answer) {
      return res.status(503).json({ error: 'AI assistant service currently unavailable' });
    }

    return res.status(200).json({ answer });
  } catch (err) {
    next(err);
  }
}

export default {
  explainScore,
  draftAlertHandler,
  handleAssistantQuestion
};
