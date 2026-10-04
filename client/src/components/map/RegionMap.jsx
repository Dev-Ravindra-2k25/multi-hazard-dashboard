import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getBandConfig } from '../../utils/bands.js';

export function RegionMap({ regions }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // Default center over India (20.5937° N, 78.9629° E)
    const map = L.map(mapContainerRef.current).setView([20.5937, 78.9629], 5);
    mapInstanceRef.current = map;

    // OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    if (regions && regions.length > 0) {
      const bounds = L.latLngBounds();

      regions.forEach((region) => {
        if (region.location && region.location.lat && region.location.lon) {
          const latLng = [region.location.lat, region.location.lon];
          bounds.extend(latLng);

          const bandConfig = getBandConfig(region.band || 'Low');
          const composite = region.composite !== null && region.composite !== undefined ? region.composite : 'N/A';

          const circle = L.circleMarker(latLng, {
            radius: 12,
            fillColor: bandConfig.color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85
          });

          const popupHtml = `
            <div style="font-family: inherit; padding: 4px;">
              <h4 style="margin: 0 0 6px 0; font-size: 1.1rem; color: #0f172a;">${region.name}</h4>
              <p style="margin: 0 0 8px 0; font-size: 0.9rem;">
                Composite Risk: <strong style="color: ${bandConfig.color}; font-size: 1.05rem;">${composite}</strong> 
                <span style="background: ${bandConfig.bg}; color: ${bandConfig.text}; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-left: 4px;">${bandConfig.name}</span>
              </p>
              <a href="/admin/regions/${region._id}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                Drill-Down Details &rarr;
              </a>
            </div>
          `;

          circle.bindPopup(popupHtml);
          circle.addTo(map);
        }
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [regions]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainerRef} className="leaflet-map-container" />
    </div>
  );
}

export default RegionMap;
