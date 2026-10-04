# SPEC — Multi-Hazard Early Warning Dashboard (v1, MERN + AI)

Full PRD: `docs/PRD.pdf` (read only if this file is unclear).

## Goal
Web app that ingests weather, seismic and river-gauge data, computes a 0-100 composite risk score per region (flood, earthquake, cyclone), and shows it in a citizen view and an admin view with alerting, history and AI-generated explanations.

## Stack (fixed, do not change)
- MongoDB + Mongoose
- Express + Node.js (ES modules), node-cron for scheduling
- React (Vite) + Leaflet (map) + Chart.js (charts)
- Auth: JWT, roles `citizen` (public, no login needed) and `admin`
- Tests: Jest + Supertest
- External data: OpenWeatherMap (weather), USGS earthquake feed, river gauge = mock CSV
- AI: one LLM provider via a single wrapper `server/src/ai/llm.js` (key in .env, server-side only)
- Deploy later: Render (API), Vercel (client), MongoDB Atlas

## Folder structure
```
server/
  src/
    app.js, server.js, config.js
    models/            # Region, Observation, RiskScore, Alert, Shelter, User, Config
    routes/            # regions, scores, alerts, admin, auth, export, ai
    controllers/
    middleware/        # auth.js (verifyJwt, requireAdmin), error.js
    ingestion/         # weather.js, seismic.js, river.js, scheduler.js
    scoring/           # indices.js, engine.js
    ai/                # llm.js, explain.js, alertDraft.js, assistant.js
    services/          # alerts.js, cache.js
  seed/                # regions.json, shelters.json, river_gauge.csv
  tests/
client/
  index.html, vite.config.js, .env.example   # VITE_API_URL
  src/
    main.jsx, App.jsx                        # App.jsx holds the router
    api/          # client.js (fetch wrapper + JWT header), regions.js, scores.js, alerts.js, admin.js, ai.js
    context/      # AuthContext.jsx (token, role, login/logout)
    hooks/        # usePolling.js, useRegions.js
    pages/
      Home.jsx            # citizen view
      NotFound.jsx
      admin/ Login.jsx, Overview.jsx, RegionDetail.jsx, Alerts.jsx, Settings.jsx
    components/
      common/    Navbar, Loader, ErrorMessage, StaleBadge, ProtectedRoute
      risk/      ScoreCard, BandBadge, HazardBreakdown, ScoreHistoryChart, AiExplanation
      map/       RegionMap
      alerts/    AlertBanner, AlertForm, AlertLog
      shelters/  ShelterList
      assistant/ ChatBox
    utils/        # bands.js (band names, colors, thresholds), format.js
    styles/       # index.css
```
Routes: `/` citizen, `/admin/login`, `/admin` (overview), `/admin/regions/:id`, `/admin/alerts`, `/admin/settings`. All `/admin/*` except login are wrapped in ProtectedRoute (role = admin).

## Collections (Mongoose)
- Region: name, location {lat, lon}, population
- Observation: regionId, source (weather|seismic|river), payload, fetchedAt
- RiskScore: regionId, floodIdx, seismicIdx, cyclonIdx, composite, band, stale, explanation (AI text, optional), computedAt. Index: {regionId, computedAt:-1}
- Alert: regionId, message, type (auto|manual), band, issuedBy, createdAt
- Shelter: regionId, name, location, capacity
- User: email, passwordHash, role
- Config: key, value (weights, thresholds)

## Scoring (deterministic, NO AI involved)
Each index is 0-100.
- Flood = 50% rainfall (24h mm, capped at 200) + 50% river level (current / danger level)
- Seismic = max magnitude within 300 km over 7 days, scaled M2 to M7 -> 0-100, decayed by age
- Cyclone = wind speed + low pressure from OpenWeatherMap as proxy; optional mocked track adds a distance term
- Composite = wFlood*flood + wSeismic*seismic + wCyclone*cyclone, default 0.4/0.3/0.3 (admin-editable, sum = 1)
- Bands: Low 0-25, Moderate 26-50, High 51-75, Severe 76-100
- Recompute every 10 min (node-cron). On API failure reuse last Observation and set `stale: true`.

## AI features (keep small, cache everything)
1. **Risk explanation**: for a RiskScore, LLM turns the indices into a 2-3 sentence plain-language explanation plus 3 safety tips. Input = the numbers only. Generated lazily on first request, then stored in `RiskScore.explanation`. Never regenerate for the same score.
2. **Admin alert drafting**: admin picks region + tone, LLM drafts the alert text (optionally translated to Hindi/regional language). Admin must edit/approve before broadcast. AI never sends alerts by itself.
3. **Citizen assistant** (last slice): short Q&A grounded only on that region's current score, shelters and guidance passed in the prompt. Rate-limited per IP; refuses off-topic questions.
Rules: AI never changes scores or bands. If the LLM call fails, hide the AI text and continue. Cap output with max_tokens. Use a small/cheap model.

## API (JSON, prefix /api)
- GET /regions, GET /regions/:id
- GET /regions/:id/score (current + breakdown)
- GET /regions/:id/history?from=&to=
- GET /regions/:id/shelters
- GET /alerts?regionId=
- POST /auth/login
- POST /admin/alerts (admin)
- GET/PUT /admin/config (admin)
- GET /export/scores.csv?regionId=&from=&to=
- POST /ai/explain/:scoreId
- POST /admin/ai/draft-alert (admin)
- POST /ai/assistant

## Pages
Citizen: Home (region search, score card, hazard breakdown, AI explanation, shelters, guidance, assistant chat).
Admin: Login, Overview map (colored by band), Region drill-down (raw data + history chart), Alerts (create with AI draft + log), Settings (weights).

## Alerting
- Auto: when a region's band moves into High or Severe, create an Alert; client polls every 15 s for in-app notification (no websockets in v1).
- Manual: admin posts message. Log = timestamp, region, issuing admin.
- SMS/email: stub (console log).

## Non-functional
- Region data loads under 2 s with seeded data
- Role check enforced server-side on every admin route
- Mobile-responsive
- New hazard type = one ingestion file + one index function + one weight

## Out of scope
Native app, real SMS, wildfire, landslide.

## MVP order
1 Scaffold 2 Models + seed 3 Ingestion 4 Scoring 5 Read API 6 Citizen UI 7 Auth + Admin UI 8 Alerts 9 History + export 10 AI features 11 Tests + deploy