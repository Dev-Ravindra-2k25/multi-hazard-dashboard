import React, { useState } from 'react';
import Navbar from '../components/common/Navbar.jsx';
import Loader from '../components/common/Loader.jsx';
import ErrorMessage from '../components/common/ErrorMessage.jsx';
import ScoreCard from '../components/risk/ScoreCard.jsx';
import HazardBreakdown from '../components/risk/HazardBreakdown.jsx';
import ShelterList from '../components/shelters/ShelterList.jsx';
import { useRegions } from '../hooks/useRegions.js';
import { getBandConfig } from '../utils/bands.js';

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

  const filteredRegions = regions.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentBand = score?.band || 'Low';
  const bandConfig = getBandConfig(currentBand);

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content">
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
