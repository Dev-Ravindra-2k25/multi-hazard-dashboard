# Multi-Hazard Early Warning Dashboard

A web platform that aggregates real-time hazard data (weather, seismic activity, river gauge levels) to compute a composite 0–100 Regional Risk Score across floods, earthquakes, and cyclones for Indian districts. Features citizen and authority views with automated alerting and AI-grounded explanations.

---

## Tech Stack

- **Backend**: Node.js (ES modules), Express, node-cron (for ingestion scheduling), Jest & Supertest
- **Database**: MongoDB & Mongoose
- **Frontend**: React (Vite), React Router, Leaflet (maps), Chart.js
- **Auth**: JWT (roles: `citizen` public, `admin`)

---

## Directory Structure

```
multi-hazard-dashboard/
├── server/
│   ├── src/
│   │   ├── app.js             # Express application & middleware
│   │   ├── server.js          # Server entrypoint
│   │   ├── config.js          # Environment configuration
│   │   ├── models/            # Mongoose models (Region, Observation, RiskScore, etc.)
│   │   ├── routes/            # Express route handlers
│   │   ├── controllers/       # Controller logic
│   │   ├── middleware/        # Auth & error handling
│   │   ├── ingestion/         # Hazard ingestion pipelines & scheduler
│   │   ├── scoring/           # Deterministic risk scoring engine
│   │   ├── ai/                # LLM explanation & alert drafting
│   │   └── services/          # Alerting & caching services
│   ├── seed/
│   │   └── regions.json       # 10 Indian district seed profiles
│   ├── tests/
│   │   └── health.test.js     # Health check & route tests
│   ├── .env.example
│   └── package.json
├── client/
│   ├── src/
│   │   ├── main.jsx           # Client entrypoint
│   │   ├── App.jsx            # Application shell & router
│   │   ├── api/               # API client wrappers
│   │   ├── context/           # Auth & state contexts
│   │   ├── hooks/             # Custom hooks
│   │   ├── pages/             # Citizen and Admin pages
│   │   ├── components/        # UI components (risk, map, alerts, shelters, assistant)
│   │   ├── utils/             # Bands, formatting utilities
│   │   └── styles/            # CSS stylesheets
│   ├── index.html
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
├── docs/                      # PRD and reference documentation
├── AGENTS.md                  # Project rules and conventions
├── PROGRESS.md                # Slice progress tracker
├── SPEC.md                    # Technical specification
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher (v24+ supported)
- **npm**: v9.0.0 or higher
- **MongoDB**: (Required starting Slice 2)

### 1. Server Setup & Run

```bash
cd server

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run in development mode (with watch)
npm run dev

# Run automated tests
npm test
```

The server starts on `http://localhost:5000`. You can verify the health route:
```bash
curl http://localhost:5000/api/health
```
Response:
```json
{
  "status": "ok",
  "uptime": 1.23,
  "timestamp": "2026-10-04T18:25:00.000Z"
}
```

### 2. Client Setup & Run

```bash
cd client

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.
