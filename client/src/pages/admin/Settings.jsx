import React, { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar.jsx';
import Loader from '../../components/common/Loader.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import { getAdminConfig, updateAdminConfig } from '../../api/admin.js';

const DEFAULT_WEIGHTS = {
  flood: 0.4,
  seismic: 0.3,
  cyclone: 0.3
};

const DEFAULT_THRESHOLDS = [25, 50, 75];

export function Settings() {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAdminConfig();
        if (data?.weights) {
          setWeights({
            flood: data.weights.flood ?? DEFAULT_WEIGHTS.flood,
            seismic: data.weights.seismic ?? DEFAULT_WEIGHTS.seismic,
            cyclone: data.weights.cyclone ?? DEFAULT_WEIGHTS.cyclone
          });
        }
        if (data?.thresholds && Array.isArray(data.thresholds)) {
          setThresholds(data.thresholds);
        }
      } catch (err) {
        setError(err.message || 'Failed to load system settings');
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleWeightChange = (key, value) => {
    const num = parseFloat(value);
    setWeights((prev) => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num
    }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleThresholdChange = (index, value) => {
    const num = parseFloat(value);
    setThresholds((prev) => {
      const next = [...prev];
      next[index] = isNaN(num) ? 0 : num;
      return next;
    });
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Compute live total with floating-point rounding
  const rawSum = (Number(weights.flood) || 0) + (Number(weights.seismic) || 0) + (Number(weights.cyclone) || 0);
  const roundedSum = Math.round(rawSum * 1000) / 1000;
  const isSumValid = Math.abs(roundedSum - 1.0) <= 0.001;

  const handleReset = () => {
    setWeights({ ...DEFAULT_WEIGHTS });
    setThresholds([...DEFAULT_THRESHOLDS]);
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isSumValid) {
      setSaveError(`Total weight must equal 1.0 (current sum: ${roundedSum})`);
      return;
    }

    if (!(thresholds[0] < thresholds[1] && thresholds[1] < thresholds[2])) {
      setSaveError('Thresholds must be strictly ascending (Low < Moderate < High)');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      await updateAdminConfig({
        weights: {
          flood: Number(weights.flood),
          seismic: Number(weights.seismic),
          cyclone: Number(weights.cyclone)
        },
        thresholds: thresholds.map(Number)
      });

      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content">
        <div className="admin-header">
          <div>
            <h2 className="page-title">⚙️ Risk Model & Engine Settings</h2>
            <p className="page-subtitle">
              Configure hazard composite formula weights and disaster risk band classification thresholds
            </p>
          </div>
        </div>

        {loading && <Loader message="Loading scoring parameters..." />}
        {error && <ErrorMessage message={error} />}

        {!loading && (
          <div className="settings-container" style={{ maxWidth: '800px', margin: '1.5rem auto 3rem' }}>
            {saveSuccess && (
              <div className="alert-feedback-banner alert-feedback-success" style={{ marginBottom: '1.5rem' }}>
                <span>✅ Configuration settings saved and applied to scoring engine successfully.</span>
                <button
                  type="button"
                  className="feedback-close-btn"
                  onClick={() => setSaveSuccess(false)}
                >
                  ✕
                </button>
              </div>
            )}

            {saveError && (
              <div className="alert-feedback-banner alert-feedback-error" style={{ marginBottom: '1.5rem' }}>
                <span>⚠️ {saveError}</span>
                <button
                  type="button"
                  className="feedback-close-btn"
                  onClick={() => setSaveError(null)}
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleSave} className="settings-form">
              {/* Card 1: Hazard Weights */}
              <div className="alert-form-card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title">⚖️ Composite Formula Weights</h3>
                  <div
                    id="weights-total"
                    style={{
                      fontWeight: 700,
                      fontSize: '1rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: isSumValid ? '#ecfdf5' : '#fef2f2',
                      color: isSumValid ? '#059669' : '#dc2626',
                      border: `1px solid ${isSumValid ? '#a7f3d0' : '#fca5a5'}`
                    }}
                  >
                    Total: {roundedSum} {isSumValid ? '✓' : '(Must equal 1.0)'}
                  </div>
                </div>

                <p className="card-subtitle" style={{ marginTop: '0.25rem', marginBottom: '1.25rem' }}>
                  Weights determine the contribution of each hazard index to the composite score (0.0 to 1.0).
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label htmlFor="weight-flood" className="form-label" style={{ fontWeight: 600 }}>
                      🌊 Flood Weight
                    </label>
                    <input
                      id="weight-flood"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      className="form-input"
                      value={weights.flood}
                      onChange={(e) => handleWeightChange('flood', e.target.value)}
                      required
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Default: 0.40</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="weight-seismic" className="form-label" style={{ fontWeight: 600 }}>
                      🌋 Seismic Weight
                    </label>
                    <input
                      id="weight-seismic"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      className="form-input"
                      value={weights.seismic}
                      onChange={(e) => handleWeightChange('seismic', e.target.value)}
                      required
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Default: 0.30</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="weight-cyclone" className="form-label" style={{ fontWeight: 600 }}>
                      🌀 Cyclone Weight
                    </label>
                    <input
                      id="weight-cyclone"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      className="form-input"
                      value={weights.cyclone}
                      onChange={(e) => handleWeightChange('cyclone', e.target.value)}
                      required
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Default: 0.30</small>
                  </div>
                </div>
              </div>

              {/* Card 2: Risk Band Thresholds */}
              <div className="alert-form-card" style={{ marginBottom: '2rem' }}>
                <h3 className="card-title">🎯 Risk Band Classification Thresholds</h3>
                <p className="card-subtitle" style={{ marginTop: '0.25rem', marginBottom: '1.25rem' }}>
                  Cutoff boundaries defining the four risk bands (must be strictly ascending numbers within 0-100).
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label htmlFor="thresh-low" className="form-label" style={{ fontWeight: 600 }}>
                      🟢 Low / Moderate Cutoff
                    </label>
                    <input
                      id="thresh-low"
                      type="number"
                      min="0"
                      max="100"
                      className="form-input"
                      value={thresholds[0]}
                      onChange={(e) => handleThresholdChange(0, e.target.value)}
                      required
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Low: 0 – {thresholds[0]}
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="thresh-mod" className="form-label" style={{ fontWeight: 600 }}>
                      🟡 Moderate / High Cutoff
                    </label>
                    <input
                      id="thresh-mod"
                      type="number"
                      min="0"
                      max="100"
                      className="form-input"
                      value={thresholds[1]}
                      onChange={(e) => handleThresholdChange(1, e.target.value)}
                      required
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Moderate: {Number(thresholds[0]) + 1} – {thresholds[1]}
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="thresh-high" className="form-label" style={{ fontWeight: 600 }}>
                      🟠 High / Severe Cutoff
                    </label>
                    <input
                      id="thresh-high"
                      type="number"
                      min="0"
                      max="100"
                      className="form-input"
                      value={thresholds[2]}
                      onChange={(e) => handleThresholdChange(2, e.target.value)}
                      required
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      High: {Number(thresholds[1]) + 1} – {thresholds[2]} | Severe: {Number(thresholds[2]) + 1}+
                    </small>
                  </div>
                </div>
              </div>

              {/* Card 3: Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-refresh"
                  style={{ cursor: 'pointer' }}
                >
                  ↺ Reset to Defaults
                </button>

                <button
                  type="submit"
                  disabled={saving || !isSumValid}
                  className="btn-broadcast-alert"
                  style={{
                    backgroundColor: isSumValid ? '#2563eb' : '#94a3b8',
                    cursor: isSumValid && !saving ? 'pointer' : 'not-allowed'
                  }}
                >
                  {saving ? '💾 Saving...' : '💾 Save Settings'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default Settings;
