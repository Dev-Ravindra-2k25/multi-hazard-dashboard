# Progress

## Done
- Slice 1: scaffold (Express/Vite skeletons, health route, 10 district seeds, README)
- Slice 2: models & seed (Mongoose models, RiskScore index, shelters seed, admin/config seed, tests)
- Slice 3: ingestion (weather, seismic 300km, river CSV, node-cron scheduler, tests)
- Slice 4: scoring (indices, engine with weights/stale flag, scheduler hook, tests)

## Next
- Slice 5: read API (GET /regions, /regions/:id/score, /shelters, /alerts, tests)

## Known issues
- none

---

# Slice prompts (paste one per new conversation)

1. **Scaffold** — Read SPEC.md. Create the backend (Flask app factory, config, health route) and frontend (Vite React) skeletons per the folder structure. Add seed/regions.json with 10 Indian districts (name, lat, lon, population). No features yet. Add README run steps.
2. **Models** — Implement the SQLAlchemy models in backend/app/models.py per SPEC.md, add migrations, and a seed script that loads regions.json and shelters.json. Add a test that the seed runs.
3. **Ingestion** — Implement ingestion/weather.py, seismic.py, river.py (mock CSV) and scheduler.py (every 10 min). Store raw payloads as Observation rows. On API failure, keep the last cached observation. Tests with mocked HTTP.
4. **Scoring** — Implement scoring/indices.py and engine.py exactly as in SPEC.md. Store RiskScore per region per cycle. Unit tests for each index and the band boundaries.
5. **Read API** — Implement GET /regions, /regions/:id/score, /regions/:id/shelters, /alerts. Tests.
6. **Citizen UI** — Build the Citizen Home page: region search, color-coded score card, hazard breakdown chart, shelter list. Use only the read API.
7. **Auth + Admin UI** — JWT login, role check decorator, admin overview map (Leaflet, colored by band), region drill-down with history chart.
8. **Alerts** — Auto alert on band change to High/Severe, manual alert endpoint and admin form, alert log, in-app notification polling every 15 s.
9. **History + Export** — History endpoint, CSV export, admin weights/thresholds settings page.
10. **Polish + Deploy** — Error states, stale-data badge, mobile layout check, deployment config for Render and Vercel, final README.