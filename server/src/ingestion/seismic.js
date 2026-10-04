import { Observation } from '../models/index.js';

const USGS_WEEK_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson';
const MAX_RADIUS_KM = 300;

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c; // Earth radius in km
}

export async function fetchUsgsSeismicFeed(feedUrl = USGS_WEEK_URL) {
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`USGS feed error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchSeismicForRegion(region, optionalFeed = null) {
  try {
    const feed = optionalFeed || (await fetchUsgsSeismicFeed());
    const features = feed.features || [];

    const { lat, lon } = region.location;
    const nearbyQuakes = [];

    for (const feature of features) {
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;

      const quakeLon = coords[0];
      const quakeLat = coords[1];
      const depth = coords[2] ?? 0;

      const distanceKm = haversineDistanceKm(lat, lon, quakeLat, quakeLon);

      if (distanceKm <= MAX_RADIUS_KM) {
        nearbyQuakes.push({
          id: feature.id,
          mag: feature.properties?.mag ?? 0,
          place: feature.properties?.place || '',
          time: feature.properties?.time ? new Date(feature.properties.time) : null,
          distanceKm: Math.round(distanceKm * 10) / 10,
          depth
        });
      }
    }

    const maxMagnitude = nearbyQuakes.reduce(
      (max, q) => Math.max(max, q.mag || 0),
      0
    );

    const payload = {
      radiusKm: MAX_RADIUS_KM,
      earthquakesCount: nearbyQuakes.length,
      maxMagnitude,
      earthquakes: nearbyQuakes
    };

    return await Observation.create({
      regionId: region._id,
      source: 'seismic',
      payload,
      fetchedAt: new Date()
    });
  } catch (error) {
    console.error(`Seismic ingestion error for region ${region.name}:`, error.message);

    // Keep and return last Observation instead of crashing
    const lastObs = await Observation.findOne({
      regionId: region._id,
      source: 'seismic'
    }).sort({ fetchedAt: -1 });

    return lastObs;
  }
}

export async function ingestAllSeismic(regions) {
  try {
    const feed = await fetchUsgsSeismicFeed();
    const results = [];
    for (const region of regions) {
      const obs = await fetchSeismicForRegion(region, feed);
      if (obs) results.push(obs);
    }
    return results;
  } catch (error) {
    console.error('Failed to fetch USGS seismic feed for all regions:', error.message);
    const results = [];
    for (const region of regions) {
      const lastObs = await Observation.findOne({
        regionId: region._id,
        source: 'seismic'
      }).sort({ fetchedAt: -1 });
      if (lastObs) results.push(lastObs);
    }
    return results;
  }
}
