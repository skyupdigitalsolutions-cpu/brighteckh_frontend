# Brightech JMS — frontend

React + Vite + TypeScript + Tailwind + TanStack Query + React Router. API contract: `openapi/brightech-openapi.json`
(223 operations; types generated into `src/api/schema.d.ts` with `npm run gen:api`). Visual design: Figma
"Brightech JMS — UI".

```bash
cp .env.example .env      # VITE_API_URL=http://localhost:3000 (backend origin; API lives under /api)
npm install
npm run dev               # http://localhost:5173
npm run typecheck && npm run build
```

## What's built (pass 1)

- **Auth** — `/login` → `POST /api/auth/login`; access token in memory + sessionStorage, refresh token in
  localStorage; single-flight `POST /api/auth/refresh` on 401 (the backend rotates refresh tokens and revokes the
  chain on replay); logout → `POST /api/auth/logout`. Identity/role/company only from `GET /api/auth/me`.
- **Shell** — desktop top nav per role (items a role can't use are not rendered) + company indicator + user menu;
  engineers get the mobile app bar. Non-engineer modules show a "not built yet" placeholder.
- **Engineer flow (mobile-first)** — `/jobs` → job → custody → inspection timer → inspection report (photo gate)
  → material request; then repair & test: material ack → repair timer (+ record part used) → repair report →
  test cycles (two-fail Purchase review gate) → handoff (+ return unused parts).

## API gaps surfaced in the UI (`GapNote` codes)

| Code | Gap |
|------|-----|
| G1  | No "my jobs" endpoint — list = own material requests + jobs opened on this device + paste-a-link box. |
| G4  | No file upload — `file_uri` is a `pending-upload://` placeholder; bytes stay on the device. |
| G5  | No item search — `GET /masters/items` is status-filtered, ≤50 rows; searched client-side. |
| G9  | Inspection media is never returned — only photos taken on this device are shown. |
| G10 | `item_bridge_id` has no lookup — material lines can't be added from the UI and show a bridge reference. |
| G13 | Purchase's inspection return comment is stored but not returned by any GET. |
