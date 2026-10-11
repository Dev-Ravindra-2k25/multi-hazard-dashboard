import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/common/Navbar.jsx';
import Loader from '../components/common/Loader.jsx';
import ErrorMessage from '../components/common/ErrorMessage.jsx';
import ScoreCard from '../components/risk/ScoreCard.jsx';
import HazardBreakdown from '../components/risk/HazardBreakdown.jsx';
import ShelterList from '../components/shelters/ShelterList.jsx';
import AlertBanner from '../components/alerts/AlertBanner.jsx';
import { useRegions } from '../hooks/useRegions.js';
import { usePolling } from '../hooks/usePolling.js';
import { getAlerts } from '../api/alerts.js';
import { getBandConfig } from '../utils/bands.js';
import { API_BASE } from '../api/client.js';

export function Home() {
  const {
    regions,
    selectedRegionId,
    setSelectedRegionId,
    selectedRegion,
    score,
    shelters,
    loading,
    error,
    isRefreshing,
    refreshScore
  } = useRegions();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeAlert, setActiveAlert] = useState(null);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState(null);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertError, setAlertError] = useState(null);

  // Initial alert load for newly selected region
  useEffect(() => {
    if (!selectedRegionId) {
      setActiveAlert(null);
      setLastSeenTimestamp(null);
      return;
    }

    let isMounted = true;
    async function loadInitialAlert() {
      try {
        setAlertLoading(true);
        setAlertError(null);
        const alerts = await getAlerts({ regionId: selectedRegionId });
        if (isMounted) {
          if (alerts && alerts.length > 0) {
            setActiveAlert(alerts[0]);
            setLastSeenTimestamp(alerts[0].createdAt);
          } else {
            setActiveAlert(null);
            setLastSeenTimestamp(new Date().toISOString());
          }
        }
      } catch (err) {
        if (isMounted) {
          setAlertError(err.message || 'Failed to check emergency alerts');
        }
      } finally {
        if (isMounted) setAlertLoading(false);
      }
    }

    loadInitialAlert();

    return () => {
      isMounted = false;
    };
  }, [selectedRegionId]);

  // Poll for new alerts for selected region every 15 seconds using ?since=
  const pollAlerts = useCallback(async () => {
    if (!selectedRegionId || !lastSeenTimestamp) return;
    try {
      const newAlerts = await getAlerts({
        regionId: selectedRegionId,
        since: lastSeenTimestamp
      });
      if (newAlerts && newAlerts.length > 0) {
        setActiveAlert(newAlerts[0]);
        setLastSeenTimestamp(newAlerts[0].createdAt);
      }
    } catch (err) {
      console.error('[Alert Polling] Error fetching updates:', err.message);
    }
  }, [selectedRegionId, lastSeenTimestamp]);

  usePolling(pollAlerts, 15000, !!selectedRegionId);

  const handleDismissAlert = () => {
    setActiveAlert(null);
  };

  const filteredRegions = regions.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentBand = score?.band || 'Low';
  const bandConfig = getBandConfig(currentBand);

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content">
        {/* Active Emergency Alert Banner */}
        <AlertBanner
          alert={activeAlert}
          onDismiss={handleDismissAlert}
          loading={alertLoading}
          error={alertError}
        />
        {/* Region Search & Select Bar */}
        <section className="search-bar-section">
          <div className="search-bar-container">
            <label htmlFor="region-search" className="search-label">
              🔍 Select District / Region:
            </label>

            <div className="search-inputs">
              <input
                id="region-search"
                type="text"
                className="search-input"
                placeholder="Search district name (e.g. Puri, Wayanad)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <select
                id="region-select"
                className="region-dropdown"
                value={selectedRegionId}
                onChange={(e) => setSelectedRegionId(e.target.value)}
              >
                {filteredRegions.length === 0 ? (
                  <option value="">No matching districts found</option>
                ) : (
                  filteredRegions.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name} {r.composite !== null ? `(${r.band || 'Risk ' + r.composite})` : ''}
                    </option>
                  ))
                )}
              </select>

              <button
                onClick={refreshScore}
                className="btn-refresh"
                title="Refresh score data"
                disabled={isRefreshing}
              >
                {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
              </button>

              {selectedRegionId && (
                <a
                  href={`${API_BASE}/export/scores.csv?regionId=${selectedRegionId}`}
                  className="download-data-link"
                  download={`scores_${selectedRegion?.name || 'region'}.csv`}
                  title="Download historical hazard score dataset in CSV format"
                  id="download-data-link"
                >
                  📥 Download data (CSV)
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Loading State */}
        {loading && !score && <Loader message="Fetching latest regional hazard scores..." />}

        {/* Error State */}
        {error && <ErrorMessage message={error} onRetry={refreshScore} />}

        {/* Main Dashboard Layout */}
        {!loading && selectedRegion && (
          <div className="dashboard-grid">
            {/* Top Row: Score Card & Hazard Breakdown */}
            <div className="grid-row">
              <ScoreCard region={selectedRegion} score={score} />
              <HazardBreakdown score={score} />
            </div>

            {/* Bottom Row: Evacuation Guidance & Shelter List */}
            <div className="grid-row">
              {/* Static Evacuation Guidance Card */}
              <div
                className="guidance-card"
                style={{
                  backgroundColor: bandConfig.bg,
                  borderColor: bandConfig.border
                }}
              >
                <div className="guidance-header">
                  <span className="guidance-icon">📢</span>
                  <div>
                    <h3 className="card-title" style={{ color: bandConfig.text }}>
                      Evacuation & Safety Guidance ({bandConfig.name} Risk)
                    </h3>
                    <p className="guidance-subtitle">Official Advisory Standard Operating Procedure</p>
                  </div>
                </div>

                <div className="guidance-body" style={{ color: bandConfig.text }}>
                  <p className="guidance-text">{bandConfig.guidance}</p>

                  <ul className="guidance-checklist">
                    <li>✅ Monitor regional hazard updates and official broadcasts.</li>
                    <li>✅ Ensure battery-operated emergency lighting and radio are ready.</li>
                    <li>✅ Keep emergency helpline numbers accessible (Disaster Management: 108 / 112).</li>
                  </ul>
                </div>
              </div>

              {/* Shelters List */}
              <ShelterList shelters={shelters} regionName={selectedRegion.name} />
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Multi-Hazard Early Warning System • Powered by Public Data Sources & Deterministic Risk Engine</p>
      </footer>
    </div>
  );
}

export default Home;
