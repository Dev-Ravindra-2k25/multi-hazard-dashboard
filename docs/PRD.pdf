Product Requirements Document

 Multi-Hazard Early Warning Dashboard
Final-Year Engineering Project | Version 1.0 | September 2026


1. Overview
The Multi-Hazard Early Warning Dashboard is a web platform that aggregates real-time hazard data
(weather, seismic activity, river gauge levels, and cyclone tracking) and computes a single composite
Regional Risk Score for floods, earthquakes, and cyclones. It gives citizens, disaster management
authorities, and NGOs a shared, real-time view of risk so that alerts and response can happen faster and with
better-targeted resources.

2. Problem Statement
Disaster-related data in India (and most regions) is fragmented across separate agencies — IMD for
weather, seismological departments for earthquakes, and river/irrigation departments for flood gauges. There
is no single, accessible, real-time composite view that combines these signals into an actionable risk score at
the district/region level. This delays both citizen awareness and authority response.

3. Goals and Objectives
• Aggregate multi-source hazard data (weather API, seismic feed, river gauge data) into one platform.
• Compute a composite, explainable Risk Score (0–100) per region, updated in near real-time.
• Provide role-based dashboards for citizens, authorities, and NGOs.
• Enable authorities to broadcast verified alerts to a specific region.
• Maintain a historical log of risk scores and incidents for post-event analysis.

4. Target Users
Persona Needs Key Actions
Citizen Know current risk level near them View risk score, receive alerts, view shelters/routes
Disaster management officer Monitor multiple regions at once View dashboard, drill into hazard layers, broadcast alerts
NGO / relief coordinator Prioritize where to send resources Cross-reference risk score with population data
Researcher / student Access historical data Export datasets, use public API

5. Scope
In scope (v1):
• Flood, earthquake, and cyclone hazard layers.
• Composite risk score calculation engine.
• Web dashboard (citizen view + admin view).
• Manual + automated alert broadcast.
• Historical data logging and basic export.
Out of scope (v1):
• Native mobile app (web-responsive only for v1).
• SMS gateway integration (stubbed / simulated for demo).
• Wildfire and landslide hazard layers (future extension).



6. Features and Functional Requirements

 6.1 Data Ingestion Module
• Fetch live weather data via a public weather API (e.g. OpenWeatherMap) on a scheduled interval.
• Fetch seismic activity data via USGS earthquake feed / equivalent regional feed.
• Ingest river gauge / water-level data (CSV feed or mock dataset for demo scale).
• Normalize all incoming data into a common schema per region.
6.2 Composite Risk Score Engine
• Compute a weighted composite score per region from flood index, seismic index, and cyclone
proximity index.
• Score bands: Low (0–25), Moderate (26–50), High (51–75), Severe (76–100).
• Weights configurable by admin (e.g. flood 40%, seismic 30%, cyclone 30%).
• Recompute on each data refresh cycle (target: every 10–15 minutes).
6.3 Dashboard (Citizen View)
• Search/select region and view current composite risk score with color-coded status.
• View individual hazard breakdown (flood, seismic, cyclone).
• View nearby shelters and basic evacuation guidance.
6.4 Dashboard (Admin / Authority View)
• Map view of all monitored regions color-coded by risk band.
• Drill-down into a region's raw hazard data and score history.
• Create and broadcast an alert to a selected region.
• Adjust scoring weights and thresholds.
6.5 Alerting
• In-app notification when a region crosses into High or Severe band.
• Admin-triggered manual alert broadcast with custom message.
• Alert log with timestamp, region, and issuing admin.
6.6 Historical Data and Export
• Store time-series of composite scores and raw hazard values per region.
• CSV export for researchers.
• Basic REST API endpoint to query historical scores.


7. Non-Functional Requirements
Category Requirement
Performance Dashboard should load region data within 2 seconds under demo-scale load.
Reliability Graceful fallback to last cached data if an external API is unavailable.
Scalability Architecture should support adding new hazard types without major rewrite.
Security Role-based access control between citizen and admin views.
Usability Color-coded, at-a-glance risk indicators; mobile-responsive layout.

8. Proposed Tech Stack
Layer Technology
Frontend React / vanilla JS + Chart.js or Leaflet for maps
Backend Flask (Python) or Node.js/Express REST API
Database PostgreSQL or MongoDB for time-series and region data
External data sources OpenWeatherMap API, USGS Earthquake API, river gauge dataset/mock
Alerting In-app + simulated SMS/email (Twilio sandbox optional)
Hosting/Deploy Render / Railway / Vercel for demo deployment

9. High-Level Data Flow
External APIs (weather, seismic, river gauge) → Data Ingestion Scheduler → Normalization Layer → Risk
Score Engine → Database (current + historical) → REST API → Dashboard (Citizen / Admin) and Alerting
Module.

10. Success Metrics
• Risk score updates reflect source data within one refresh cycle (10–15 min).
• Dashboard usable by a non-technical evaluator without instructions (demo criterion).
• At least 3 hazard types integrated with live or realistic mock data.
• Alert broadcast to database-to-UI latency under 5 seconds in demo.
11. Suggested Timeline (12-Week Plan)

Weeks Milestone
1–2 Requirements finalization, API access setup, schema design
3–5 Data ingestion module + normalization layer
6–7 Risk score engine + scoring logic validation
8–9 Citizen dashboard UI
10 Admin dashboard + alerting module
11 Historical data/export + API endpoints
12 Testing, deployment, documentation, demo prep
12. Risks and Mitigations
Risk Mitigation
Free-tier API rate limits Cache responses; use mock/historical data as fallback for demo
Incomplete real-time river gauge data availability Use a realistic simulated dataset if live feed unavailable
Scope creep (adding too many hazard types) Lock v1 scope to flood, earthquake, cyclone only
End of document.