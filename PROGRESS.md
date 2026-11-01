# Progress

## Done
- Slice 1: scaffold (Express/Vite skeletons, health route, 10 district seeds, README)
- Slice 2: models & seed (Mongoose models, RiskScore index, shelters seed, admin/config seed, tests)
- Slice 3: ingestion (weather, seismic 300km, river CSV, node-cron scheduler, tests)
- Slice 4: scoring (indices, engine with weights/stale flag, scheduler hook, tests)
- Slice 5: read API (GET /regions, /regions/:id/score, /shelters, /alerts, tests)
- Slice 6: citizen UI (home page, search, score card, breakdown chart, shelters, 60s polling)
- Slice 7: auth + admin UI (JWT 8h login, rate limiting, Leaflet map overview, region drill-down, history chart, tests)
- Slice 8: alerts (auto alert on band change to High/Severe, 60-min deduplication, manual alert endpoint, admin form & log, stub notifier, citizen polling every 15s)
- Slice 9: history + export (CSV export streaming with cursor, admin config weights & band thresholds endpoints, dynamic scoring engine, Settings page, CSV download on RegionDetail & Home)
- Slice 10: AI features (deterministic rule, ai/llm.js with 15s timeout & 300 token cap, ai/explain.js & cached POST /api/ai/explain/:scoreId, ai/alertDraft.js & POST /api/admin/ai/draft-alert with untrusted input validation, citizen AiExplanation component, admin AlertForm Draft with AI, Jest tests)
- Slice 11: Citizen assistant (read-only assistant, ai/assistant.js with maxTokens 250, delimited DATA block with prompt defense, POST /api/ai/assistant with 10/min and 100/day IP rate limit, ChatBox component with suggestion chips, 300-char counter, emergency disclaimer, Jest tests)

## Next
- Polish + Deploy (error states, stale-data badge, mobile layout check, deployment config for Render and Vercel, final README)

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