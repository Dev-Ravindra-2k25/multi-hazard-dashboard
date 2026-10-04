import { config } from '../config.js';
import { Observation } from '../models/index.js';

export async function fetchWeatherForRegion(region) {
  const { lat, lon } = region.location;
  const apiKey = config.openWeatherApiKey;

  try {
    if (!apiKey) {
      throw new Error('OPENWEATHER_API_KEY is not set');
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OpenWeather API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const rainfall24h = data.rain
      ? (data.rain['24h'] ?? (data.rain['1h'] ? data.rain['1h'] * 24 : 0))
      : 0;

    const payload = {
      temperature: data.main?.temp ?? 0,
      pressure: data.main?.pressure ?? 1013,
      humidity: data.main?.humidity ?? 0,
      windSpeed: data.wind?.speed ?? 0,
      rainfall24h: Math.round(rainfall24h * 100) / 100,
      description: data.weather?.[0]?.description || '',
      cityName: data.name || region.name
    };

    return await Observation.create({
      regionId: region._id,
      source: 'weather',
      payload,
      fetchedAt: new Date()
    });
  } catch (error) {
    console.error(`Weather ingestion error for region ${region.name}:`, error.message);

    // Keep and return last Observation instead of crashing
    const lastObs = await Observation.findOne({
      regionId: region._id,
      source: 'weather'
    }).sort({ fetchedAt: -1 });

    return lastObs;
  }
}

export async function ingestAllWeather(regions) {
  const results = [];
  for (const region of regions) {
    const obs = await fetchWeatherForRegion(region);
    if (obs) results.push(obs);
  }
  return results;
}
