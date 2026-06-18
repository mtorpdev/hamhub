# POTA Live Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first POTA page for hunters and activators with live spots, filters, a map of currently active parks, and an activator-focused view.

**Architecture:** The backend exposes a cached read-only POTA endpoint that shields the frontend from the public `api.pota.app` shape. The frontend adds typed POTA API calls, small pure helpers for filtering/map markers, a `/pota` page with Live and Kort tabs, and a navbar link.

**Tech Stack:** ASP.NET Core controllers/services, `HttpClient`, Next.js app router, existing Leaflet map component, Node test runner.

## Global Constraints

- First version supports both hunters and activators: active spots, online parks, and activator-focused spot filtering.
- Cache POTA calls server-side for a short interval to avoid excessive upstream traffic.
- Do not post spots or require POTA authentication.
- Keep UI consistent with existing HamHub dark operational pages.
- Use TDD for backend service/controller behavior and frontend pure helpers.

---

### Task 1: Backend POTA Spots Feed

**Files:**
- Create: `backend/HamHub.Api/Services/PotaClient.cs`
- Create: `backend/HamHub.Api/Controllers/PotaController.cs`
- Modify: `backend/HamHub.Api/Program.cs`
- Test: `backend/HamHub.Api.Tests/PotaClientTests.cs`

**Interfaces:**
- Produces: `PotaClient.GetActiveSpotsAsync(CancellationToken ct) : Task<IReadOnlyList<PotaSpotDto>>`
- Produces: `GET /api/pota/spots`

- [ ] Write failing tests for parsing active POTA spot JSON and caching results.
- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj --filter PotaClientTests` and confirm failure because `PotaClient` is missing.
- [ ] Implement DTOs, client parsing, cache, controller, and DI registration.
- [ ] Re-run targeted backend tests and confirm pass.

### Task 2: Frontend POTA Helpers and Page

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/pota/potaFilters.ts`
- Create: `frontend/src/app/pota/potaFilters.test.ts`
- Create: `frontend/src/app/pota/page.tsx`

**Interfaces:**
- Consumes: `api.pota.getSpots() : Promise<PotaSpot[]>`
- Produces: `filterPotaSpots(spots, filters) : PotaSpot[]`
- Produces: `buildPotaMapMarkers(spots) : MapMarker[]`
- Produces: `/pota` tabs for `Live`, `Kort`, and `Activator`

- [ ] Write failing frontend tests for filtering by search, band, mode, activator callsign, and only-spotted-online markers.
- [ ] Run `npm.cmd test src/app/pota/potaFilters.test.ts` and confirm failure because helper file is missing.
- [ ] Implement types, API call, helpers, and `/pota` UI with Live, Kort, and Activator tabs.
- [ ] Re-run targeted frontend tests and confirm pass.

### Task 3: Navigation, Verification, Deploy

**Files:**
- Modify: `frontend/src/components/layout/Navbar.tsx`

- [ ] Add POTA to desktop and mobile navigation.
- [ ] Run `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, and `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj`.
- [ ] Commit, merge to master, push, and watch the production deploy.
