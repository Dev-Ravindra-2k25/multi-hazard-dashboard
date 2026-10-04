import React from 'react';

export function ShelterList({ shelters, regionName }) {
  if (!shelters || shelters.length === 0) {
    return (
      <div className="shelter-card">
        <h3 className="card-title">Emergency Shelters</h3>
        <p className="empty-text">No registered emergency shelters found for {regionName || 'this region'}.</p>
      </div>
    );
  }

  return (
    <div className="shelter-card">
      <div className="shelter-header">
        <h3 className="card-title">🏫 Emergency Shelters ({shelters.length})</h3>
        <span className="shelter-sub">Relief & Evacuation Facilities in {regionName}</span>
      </div>

      <div className="shelters-grid">
        {shelters.map((shelter) => (
          <div key={shelter._id || shelter.name} className="shelter-item">
            <div className="shelter-icon">⛺</div>
            <div className="shelter-details">
              <h4 className="shelter-name">{shelter.name}</h4>
              <p className="shelter-meta">
                Capacity: <strong>{Number(shelter.capacity).toLocaleString('en-IN')} people</strong>
              </p>
              {shelter.location && (
                <p className="shelter-coords">
                  📍 {shelter.location.lat.toFixed(4)}° N, {shelter.location.lon.toFixed(4)}° E
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ShelterList;
