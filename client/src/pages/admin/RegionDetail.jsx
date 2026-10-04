import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../../components/common/Navbar.jsx';
import Loader from '../../components/common/Loader.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import ScoreCard from '../../components/risk/ScoreCard.jsx';
import HazardBreakdown from '../../components/risk/HazardBreakdown.jsx';
import ScoreHistoryChart from '../../components/risk/ScoreHistoryChart.jsx';
import { getRegion } from '../../api/regions.js';
import { getRegionScore, getRegionHistory } from '../../api/scores.js';
import { getAdminRegionObservations } from '../../api/admin.js';

export function RegionDetail() {
  const { id } = useParams();

  const [region, setRegion] = useState(null);
  const [score, setScore] = useState(null);
  const [observations, setObservations] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetailData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [regionData, scoreData, obsData, historyData] = await Promise.all([
        getRegion(id),
        getRegionScore(id).catch(() => null),
        getAdminRegionObservations(id).catch(() => null),
        getRegionHistory(id).catch(() => [])
      ]);

      setRegion(regionData);
      setScore(scoreData);
      setObservations(obsData);
      setHistory(historyData || []);
    } catch (err) {
      setError(err.message || 'Failed to load region drill-down details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetailData();
    }
  }, [id]);

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content">
        <div className="detail-header">
          <Link to="/admin" className="btn-back">
            &larr; Back to Admin Overview
          </Link>
          <h2>District Drill-Down Analysis</h2>
        </div>

        {loading && <Loader message="Fetching region observations and score history..." />}
        {error && <ErrorMessage message={error} onRetry={fetchDetailData} />}

        {!loading && region && (
          <div className="detail-grid">
            {/* Row 1: Score Card & Hazard Breakdown */}
            <div className="grid-row">
              <ScoreCard region={region} score={score} />
              <HazardBreakdown score={score} />
            </div>

            {/* Row 2: Raw Ingestion Observations */}
            <div className="observations-card">
              <h3 className="card-title">📡 Latest Raw Ingestion Observations</h3>
              <p className="card-subtitle">Raw payload payloads ingested per data source</p>

              <div className="obs-grid">
                {/* Weather Observation */}
                <div className="obs-box">
                  <div className="obs-box-header">
                    <span>🌦️ Weather Observation</span>
                    <span className="obs-date">
                      {observations?.weather?.fetchedAt
                        ? new Date(observations.weather.fetchedAt).toLocaleTimeString()
                        : 'No Data'}
                    </span>
                  </div>
                  <pre className="obs-json">
                    {observations?.weather?.payload
                      ? JSON.stringify(observations.weather.payload, null, 2)
                      : 'No weather payload available'}
                  </pre>
                </div>

                {/* Seismic Observation */}
                <div className="obs-box">
                  <div className="obs-box-header">
                    <span>🌋 Seismic Observation</span>
                    <span className="obs-date">
                      {observations?.seismic?.fetchedAt
                        ? new Date(observations.seismic.fetchedAt).toLocaleTimeString()
                        : 'No Data'}
                    </span>
                  </div>
                  <pre className="obs-json">
                    {observations?.seismic?.payload
                      ? JSON.stringify(observations.seismic.payload, null, 2)
                      : 'No seismic payload available'}
                  </pre>
                </div>

                {/* River Observation */}
                <div className="obs-box">
                  <div className="obs-box-header">
                    <span>🌊 River Gauge Observation</span>
                    <span className="obs-date">
                      {observations?.river?.fetchedAt
                        ? new Date(observations.river.fetchedAt).toLocaleTimeString()
                        : 'No Data'}
                    </span>
                  </div>
                  <pre className="obs-json">
                    {observations?.river?.payload
                      ? JSON.stringify(observations.river.payload, null, 2)
                      : 'No river gauge payload available'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Row 3: Score History Chart */}
            <ScoreHistoryChart history={history} />
          </div>
        )}
      </main>
    </div>
  );
}

export default RegionDetail;
