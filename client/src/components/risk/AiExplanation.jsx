import React, { useState, useEffect } from 'react';
import { getAiExplanation } from '../../api/ai.js';

export function AiExplanation({ score }) {
  const [explanation, setExplanation] = useState(score?.explanation || null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setExplanation(score?.explanation || null);
    setLoading(false);
    setFailed(false);
  }, [score?._id, score?.explanation]);

  // If request fails, hide the section completely without an error banner
  if (failed) {
    return null;
  }

  if (!score || !score._id) {
    return null;
  }

  const handleExplain = async () => {
    try {
      setLoading(true);
      setFailed(false);
      const res = await getAiExplanation(score._id);
      if (res?.explanation) {
        setExplanation(res.explanation);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ai-explanation-card ai-explanation-loading">
        <div className="ai-loading-content">
          <span className="ai-spinner"></span>
          <span className="ai-loading-text">Generating AI-powered explanation...</span>
        </div>
      </div>
    );
  }

  if (explanation) {
    return (
      <div className="ai-explanation-card">
        <div className="ai-explanation-header">
          <span className="ai-sparkle">✨</span>
          <span className="ai-header-title">AI-generated summary</span>
        </div>
        <div className="ai-explanation-body">
          <p className="ai-explanation-text">{explanation}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-explanation-action">
      <button
        type="button"
        className="btn-explain-score"
        onClick={handleExplain}
        id="btn-explain-score"
      >
        ✨ Explain this score
      </button>
    </div>
  );
}

export default AiExplanation;
