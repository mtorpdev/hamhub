# Awards Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first backend-owned awards foundation with expanded QSO award fields, a reusable award engine, authenticated awards API endpoints, and a `/awards` overview page.

**Architecture:** Extend `QsoEntry` and QSO DTOs with first-class award dimensions, then add a backend award catalog and engine that calculates worked, confirmed, missing, and unconfirmed progress. The frontend consumes the new API through `frontend/src/lib/api.ts` and renders a work-focused `/awards` page plus a navbar link.

**Tech Stack:** ASP.NET Core controllers, EF Core/Npgsql migrations, AutoMapper, xUnit, Next.js 16 App Router, React 19, TypeScript, Node test runner, Tailwind CSS.

## Global Constraints

- Use backend-owned award calculations as the source of truth for `/awards`.
- Keep Live Rooster's current frontend scoring working during this phase.
- Do not claim or submit awards to external sponsors.
- Do not add full POTA/SOTA external dataset synchronization in this phase.
- Show awards that cannot be fully calculated as `missing-data` or `coming-next`, not as real progress.
- Use TDD for new behavior: write a failing test, run it red, then implement.

---

## File Structure

- `backend/HamHub.Domain/Entities/QsoEntry.cs`: add award dimension fields.
- `backend/HamHub.Application/QsoEntries/DTOs/QsoDto.cs`: expose new QSO fields to the frontend.
- `backend/HamHub.Application/QsoEntries/DTOs/CreateQsoDto.cs`: accept new fields on create/update/import.
- `backend/HamHub.Infrastructure/Persistence/Configurations/QsoEntryConfiguration.cs`: set string lengths/indexes for new fields.
- `backend/HamHub.Infrastructure/Migrations/*AddAwardFieldsToQsos*`: persist new columns.
- `backend/HamHub.Api/Services/Awards/AwardModels.cs`: award DTOs and domain records.
- `backend/HamHub.Api/Services/Awards/AwardCatalog.cs`: static phase-one and future award definitions.
- `backend/HamHub.Api/Services/Awards/AwardEngine.cs`: reusable progress calculator.
- `backend/HamHub.Api/Controllers/AwardsController.cs`: authenticated catalog/summary/detail endpoints.
- `backend/HamHub.Api.Tests/AwardEngineTests.cs`: engine behavior tests.
- `backend/HamHub.Api.Tests/AwardsControllerTests.cs`: endpoint authorization/shape tests.
- `frontend/src/lib/types.ts`: awards API types and new QSO fields.
- `frontend/src/lib/api.ts`: awards API client methods.
- `frontend/src/app/awards/awardSummary.test.ts`: frontend summary helpers tests.
- `frontend/src/app/awards/awardSummary.ts`: UI helper functions.
- `frontend/src/app/awards/page.tsx`: awards overview UI.
- `frontend/src/components/layout/Navbar.tsx`: navigation link.

---

### Task 1: Backend Award Fields

**Files:**
- Test: `backend/HamHub.Api.Tests/AwardEngineTests.cs`
- Modify: `backend/HamHub.Domain/Entities/QsoEntry.cs`
- Modify: `backend/HamHub.Application/QsoEntries/DTOs/QsoDto.cs`
- Modify: `backend/HamHub.Application/QsoEntries/DTOs/CreateQsoDto.cs`
- Modify: `backend/HamHub.Infrastructure/Persistence/Configurations/QsoEntryConfiguration.cs`
- Create: `backend/HamHub.Infrastructure/Migrations/<timestamp>_AddAwardFieldsToQsos.cs`
- Modify: `backend/HamHub.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs`

**Interfaces:**
- Produces QSO fields: `CqZone`, `ItuZone`, `County`, `MyState`, `MyCounty`, `PotaRefs`, `SotaRefs`, `AwardRefs`.

- [ ] Write a failing compile-level test in `AwardEngineTests.cs` that constructs `QsoEntry` with `CqZone`, `ItuZone`, `County`, `PotaRefs`, and `SotaRefs`.
- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj --filter AwardEngineTests` and confirm RED because the new properties do not exist.
- [ ] Add the properties to `QsoEntry`, `QsoDto`, and `CreateQsoDto`.
- [ ] Configure string lengths: `County`, `MyState`, and `MyCounty` length 128; `PotaRefs`, `SotaRefs`, and `AwardRefs` length 512.
- [ ] Create the EF migration with `dotnet ef migrations add AddAwardFieldsToQsos --project backend\HamHub.Infrastructure --startup-project backend\HamHub.Api`.
- [ ] Run the filtered test and confirm GREEN.

### Task 2: Award Catalog And Engine

**Files:**
- Test: `backend/HamHub.Api.Tests/AwardEngineTests.cs`
- Create: `backend/HamHub.Api/Services/Awards/AwardModels.cs`
- Create: `backend/HamHub.Api/Services/Awards/AwardCatalog.cs`
- Create: `backend/HamHub.Api/Services/Awards/AwardEngine.cs`
- Modify: `backend/HamHub.Api/Program.cs`

**Interfaces:**
- Produces: `AwardEngine.Calculate(IEnumerable<QsoEntry> qsos, AwardQuery query): AwardSummaryResponse`
- Produces: `AwardCatalog.All`
- Produces DTOs: `AwardCatalogItemDto`, `AwardProgressDto`, `AwardEntityProgressDto`, `AwardSummaryResponse`, `AwardDetailResponse`, `AwardQuery`.

- [ ] Add tests for DXCC worked/confirmed/missing progress using QSOs with numeric `Dxcc`.
- [ ] Add tests for WAC continent progress, prefix progress, grid progress, CQ zone missing-data status, and unconfirmed entity lists.
- [ ] Run filtered tests and confirm RED because `AwardEngine` does not exist.
- [ ] Implement `AwardModels.cs` with immutable records.
- [ ] Implement `AwardCatalog.cs` with phase-one active awards: `dxcc`, `dxcc-band`, `dxcc-mode`, `wac`, `wpx`, `grid`, `confirmed-dxcc`; phase-two/three awards as `missing-data` or `coming-next`.
- [ ] Implement `AwardEngine.cs` with reusable entity extraction for active awards and status pass-through for inactive awards.
- [ ] Register `AwardEngine` in DI.
- [ ] Run filtered tests and confirm GREEN.

### Task 3: Awards API

**Files:**
- Test: `backend/HamHub.Api.Tests/AwardsControllerTests.cs`
- Create: `backend/HamHub.Api/Controllers/AwardsController.cs`

**Interfaces:**
- Consumes: `AwardEngine.Calculate(...)`
- Produces endpoints:
  - `GET /api/awards/catalog`
  - `GET /api/awards/summary`
  - `GET /api/awards/{id}`

- [ ] Add controller tests for catalog response, summary response scoped to authenticated user, and detail 404 for unknown award.
- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj --filter AwardsControllerTests` and confirm RED.
- [ ] Implement `AwardsController` with `[Authorize]`, query filters, user scoping, and detail lookup.
- [ ] Run controller tests and confirm GREEN.

### Task 4: Frontend Awards Client And Helpers

**Files:**
- Test: `frontend/src/app/awards/awardSummary.test.ts`
- Create: `frontend/src/app/awards/awardSummary.ts`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `api.awards.getCatalog()`, `api.awards.getSummary(filters?)`, `api.awards.getDetail(id, filters?)`.
- Produces helper: `awardStatusLabel(status: AwardStatus): string`.

- [ ] Add tests for status labels and next-threshold formatting.
- [ ] Run `npm.cmd test -- src/app/awards/awardSummary.test.ts` and confirm RED.
- [ ] Add award types and API methods.
- [ ] Implement `awardSummary.ts`.
- [ ] Run the awards helper test and confirm GREEN.

### Task 5: Awards Page UI

**Files:**
- Modify: `frontend/src/app/awards/page.tsx`
- Modify: `frontend/src/components/layout/Navbar.tsx`

**Interfaces:**
- Consumes: `api.awards.getSummary`.
- Consumes: `AwardSummaryResponse`.

- [ ] Add `/awards` page with auth guard, filters for callsign/band/mode/sponsor/status, active progress cards, data warning cards, and award table.
- [ ] Add a navbar link named `Awards`.
- [ ] Run `npx.cmd eslint src/app/awards src/lib/api.ts src/lib/types.ts src/components/layout/Navbar.tsx`.
- [ ] Run `npm.cmd run build`.

### Task 6: Full Verification And Publish

**Files:**
- All files modified above.

- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj`.
- [ ] Run `npm.cmd test -- src/app/awards/awardSummary.test.ts`.
- [ ] Run `npx.cmd eslint src/app/awards src/lib/api.ts src/lib/types.ts src/components/layout/Navbar.tsx`.
- [ ] Run `npm.cmd run build`.
- [ ] Run local smoke for `/awards` if the dev server is available.
- [ ] Commit with `feat: add awards foundation`.
- [ ] Push branch or merge/deploy only after approval.
