import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/common/Navbar.jsx';
import Loader from '../../components/common/Loader.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import RegionMap from '../../components/map/RegionMap.jsx';
import BandBadge from '../../components/risk/BandBadge.jsx';
import StaleBadge from '../../components/common/StaleBadge.jsx';
import { getRegions } from '../../api/regions.js';

export function Overview() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRegions();
      setRegions(data);
    } catch (err) {
      setError(err.message || 'Failed to load regions overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content">
        <div className="admin-header">
          <div>
            <h2 className="page-title">🗺️ Regional Risk Overview Map</h2>
            <p className="page-subtitle">Real-time risk status across all monitored Indian districts</p>
          </div>
          <button onClick={fetchOverviewData} className="btn-refresh">
            🔄 Refresh Map Data
          </button>
        </div>

        {loading && <Loader message="Loading map and regional risk indicators..." />}
        {error && <ErrorMessage message={error} onRetry={fetchOverviewData} />}

        {!loading && !error && (
          <div className="admin-overview-grid">
            {/* Interactive Leaflet Map */}
            <div className="map-card">
              <RegionMap regions={regions} />
            </div>

            {/* Regions List Table */}
            <div className="table-card">
              <h3 className="card-title">Monitored Regions Summary</h3>
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Region Name</th>
                      <th>Coordinates</th>
                      <th>Population</th>
                      <th>Composite Risk</th>
                      <th>Status Band</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regions.map((region) => (
                      <tr key={region._id}>
                        <td className="font-bold">{region.name}</td>
                        <td className="text-muted">
                          {region.location.lat.toFixed(2)}°, {region.location.lon.toFixed(2)}°
                        </td>
                        <td>{Number(region.population).toLocaleString('en-IN')}</td>
                        <td className="font-bold">
                          {region.composite !== null ? region.composite : 'N/A'}
                        </td>
                        <td>
                          <div className="table-badges">
                            {region.stale && <StaleBadge />}
                            <BandBadge band={region.band || 'Low'} />
                          </div>
                        </td>
                        <td>
                          <Link to={`/admin/regions/${region._id}`} className="btn-drilldown">
                            Drill Down &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Overview;
