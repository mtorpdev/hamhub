# Awards Reference Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate IOTA, POTA, SOTA, and county award progress from QSO reference fields and make ADIF import/export preserve those fields.

**Architecture:** Keep the award engine backend-owned. Add reusable parsing for single and multi-reference QSO fields, promote the reference-based awards to active, and extend `QsosController` ADIF import/export mapping for award dimensions.

**Tech Stack:** ASP.NET Core controllers, EF Core in-memory tests, xUnit, existing awards engine.

## Global Constraints

- Do not add external POTA/SOTA/IOTA datasets in this slice.
- Count only explicit QSO fields, never infer counties or references from callsign alone.
- Normalize references to uppercase and split multi-reference fields on comma, semicolon, or whitespace.
- Preserve ADIF compatibility using common field names: `CNTY`, `CQZ`, `ITUZ`, `IOTA`, `POTA_REF`, `SOTA_REF`, `MY_STATE`, `MY_CNTY`, and `AWARD_SUBMITTED`.
- Use TDD for new behavior.

---

### Task 1: Reference Award Engine

**Files:**
- Modify: `backend/HamHub.Api.Tests/AwardEngineTests.cs`
- Modify: `backend/HamHub.Api/Services/Awards/AwardCatalog.cs`
- Modify: `backend/HamHub.Api/Services/Awards/AwardEngine.cs`

- [ ] Add failing tests for IOTA, POTA, SOTA, and county counts.
- [ ] Activate the four awards in the catalog.
- [ ] Add entity extraction for `iota`, `pota`, `sota`, and `cnty`.
- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj --filter AwardEngineTests`.

### Task 2: ADIF Import And Export

**Files:**
- Create: `backend/HamHub.Api.Tests/QsosControllerAdifTests.cs`
- Modify: `backend/HamHub.Api/Controllers/QsosController.cs`

- [ ] Add failing controller tests showing ADIF import stores award fields.
- [ ] Add failing controller tests showing ADIF export includes award fields.
- [ ] Extend import mapping for `CNTY`, `CQZ`, `ITUZ`, `POTA_REF`, `SOTA_REF`, `MY_STATE`, `MY_CNTY`, and `AWARD_SUBMITTED`.
- [ ] Extend export mapping for the same fields.
- [ ] Run controller tests.

### Task 3: Verification And Deploy

- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj`.
- [ ] Run `npm.cmd test -- src/app/awards/awardSummary.test.ts`.
- [ ] Run `npx.cmd eslint src/app/awards src/lib/api.ts src/lib/types.ts src/components/layout/Navbar.tsx`.
- [ ] Run `npm.cmd run build`.
- [ ] Commit with `feat: activate reference awards`.
- [ ] Push and deploy after verification.
