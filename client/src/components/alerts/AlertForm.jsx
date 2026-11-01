import React, { useState, useEffect } from 'react';
import { createAdminAlert } from '../../api/alerts.js';
import { draftAiAlert } from '../../api/ai.js';

export function AlertForm({ regions = [], onAlertSent }) {
  const [regionId, setRegionId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // AI draft states
  const [tone, setTone] = useState('urgent');
  const [language, setLanguage] = useState('en');
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const [isAiDraft, setIsAiDraft] = useState(false);

  const MAX_CHARS = 500;

  useEffect(() => {
    if (!regionId && regions && regions.length > 0) {
      setRegionId(regions[0]._id);
    }
  }, [regions, regionId]);

  const handleDraftWithAi = async () => {
    if (!regionId) {
      setError('Please select a target region first.');
      return;
    }

    try {
      setDrafting(true);
      setDraftError(null);
      setError(null);

      const res = await draftAiAlert({ regionId, tone, language });
      if (res?.draft) {
        setMessage(res.draft);
        setIsAiDraft(true);
      } else {
        setDraftError('Failed to generate draft. Please try again.');
      }
    } catch (err) {
      setDraftError(err.message || 'AI alert drafting unavailable');
    } finally {
      setDrafting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!regionId) {
      setError('Please select a target region.');
      return;
    }

    const trimmed = message.trim();
    if (!trimmed) {
      setError('Alert message cannot be empty.');
      return;
    }

    if (trimmed.length > MAX_CHARS) {
      setError(`Message exceeds the maximum limit of ${MAX_CHARS} characters.`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const createdAlert = await createAdminAlert({
        regionId,
        message: trimmed
      });

      setSuccess('Alert broadcasted successfully! Citizens in this region will be alerted.');
      setMessage('');
      setIsAiDraft(false);
      if (onAlertSent) {
        onAlertSent(createdAlert);
      }
    } catch (err) {
      setError(err.message || 'Failed to issue emergency alert');
    } finally {
      setLoading(false);
    }
  };

  const charsRemaining = MAX_CHARS - message.length;

  return (
    <div className="alert-form-card">
      <div className="card-header">
        <h3 className="card-title">📢 Issue Manual Emergency Alert</h3>
        <p className="card-subtitle">
          Broadcast an official administrative advisory or evacuation notice to citizens
        </p>
      </div>

      {success && (
        <div className="alert-feedback alert-feedback-success" role="status">
          <span>✅ {success}</span>
          <button
            type="button"
            className="feedback-close-btn"
            onClick={() => setSuccess(null)}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="alert-feedback alert-feedback-error" role="alert">
          <span>⚠️ {error}</span>
          <button
            type="button"
            className="feedback-close-btn"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="alert-form">
        <div className="form-group">
          <label htmlFor="alert-region-select" className="form-label">
            Target District / Region:
          </label>
          <select
            id="alert-region-select"
            className="form-select"
            value={regionId}
            onChange={(e) => {
              setRegionId(e.target.value);
              setIsAiDraft(false);
            }}
            disabled={loading}
          >
            {regions.length === 0 ? (
              <option value="">No regions loaded</option>
            ) : (
              regions.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name} {r.band ? `(${r.band} Risk)` : ''}
                </option>
              ))
            )}
          </select>
        </div>

        {/* AI Alert Drafting Controls */}
        <div className="ai-draft-section">
          <div className="ai-draft-header">
            <span className="ai-sparkle">✨</span>
            <span className="ai-draft-title">AI Alert Drafter (Assisted Broadcast)</span>
          </div>
          <div className="ai-draft-controls">
            <div className="draft-control-item">
              <label htmlFor="draft-tone-select" className="draft-control-label">Tone:</label>
              <select
                id="draft-tone-select"
                className="draft-select"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                disabled={drafting || loading}
              >
                <option value="urgent">Urgent</option>
                <option value="calm">Calm</option>
                <option value="formal">Formal</option>
              </select>
            </div>

            <div className="draft-control-item">
              <label htmlFor="draft-language-select" className="draft-control-label">Language:</label>
              <select
                id="draft-language-select"
                className="draft-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={drafting || loading}
              >
                <option value="en">English (en)</option>
                <option value="hi">Hindi (hi)</option>
                <option value="ta">Tamil (ta)</option>
                <option value="te">Telugu (te)</option>
                <option value="bn">Bengali (bn)</option>
                <option value="mr">Marathi (mr)</option>
              </select>
            </div>

            <button
              type="button"
              id="btn-draft-ai"
              className="btn-draft-ai"
              onClick={handleDraftWithAi}
              disabled={drafting || loading || !regionId}
            >
              {drafting ? '🤖 Drafting...' : '✨ Draft with AI'}
            </button>
          </div>
          {draftError && <p className="ai-draft-error-text">⚠️ {draftError}</p>}
        </div>

        <div className="form-group">
          <div className="label-with-counter">
            <label htmlFor="alert-message" className="form-label">
              Emergency Message:
            </label>
            <span
              className={`char-counter ${charsRemaining < 50 ? 'counter-warning' : ''}`}
            >
              {message.length} / {MAX_CHARS} characters
            </span>
          </div>

          {isAiDraft && (
            <div className="ai-draft-note" role="note">
              ℹ️ AI draft: review before sending
            </div>
          )}

          <textarea
            id="alert-message"
            className="form-textarea"
            rows="4"
            maxLength={MAX_CHARS}
            placeholder="Type emergency alert bulletin, evacuation route, or hazard warning (e.g. Flash flood warning: Move to higher ground immediately)..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (error) setError(null);
            }}
            disabled={loading}
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-broadcast-alert"
            disabled={loading || !message.trim() || !regionId}
          >
            {loading ? '📡 Broadcasting Alert...' : '🚨 Broadcast Emergency Alert'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AlertForm;
