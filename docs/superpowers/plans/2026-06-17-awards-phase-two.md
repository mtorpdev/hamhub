# Awards Phase Two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the next award families that can be calculated from the new QSO award fields: WAZ/CQ zones, ITU zones, WAS, and Canadian provinces.

**Architecture:** Keep the existing backend-owned awards engine and catalog. Promote the reliable phase-two definitions from `missing-data` to `active`, add reusable entity extraction for CQ zones, ITU zones, and state/province awards, and update frontend/detail behavior only where the existing UI needs clearer labels.

**Tech Stack:** ASP.NET Core, xUnit, Next.js/TypeScript helpers, existing awards API.

## Global Constraints

- Use backend-owned award calculations as the source of truth.
- Keep POTA, SOTA, IOTA, counties, and special awards out of active status until import/enrichment is reliable.
- Use TDD for new award behavior.
- Do not change deployment workflow in this slice.

---

### Task 1: Activate Zone And State Awards

**Files:**
- Modify: `backend/HamHub.Api.Tests/AwardEngineTests.cs`
- Modify: `backend/HamHub.Api/Services/Awards/AwardCatalog.cs`
- Modify: `backend/HamHub.Api/Services/Awards/AwardEngine.cs`

**Interfaces:**
- `AwardEngine.Calculate(IEnumerable<QsoEntry> qsos, AwardQuery query)` returns active progress for `waz`, `itu-zones`, `was`, and `canada-provinces`.
- `AwardEngine.Detail(IEnumerable<QsoEntry> qsos, string id, AwardQuery query)` returns entity rows and missing rows for the same awards.

- [ ] Add failing tests for WAZ, ITU zones, WAS, and Canadian province progress.
- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj --filter AwardEngineTests` and confirm the tests fail because those awards are still missing-data or unimplemented.
- [ ] Change catalog statuses to `active` and add entity universes for CQ zones 1-40, ITU zones 1-75, US states 50, and Canadian provinces/territories 13.
- [ ] Add rule extraction for `cqz`, `ituz`, `states-us`, and `states-ca`.
- [ ] Run the filtered backend tests and confirm they pass.

### Task 2: Frontend Helper Labels

**Files:**
- Modify: `frontend/src/app/awards/awardSummary.test.ts`
- Modify: `frontend/src/app/awards/awardSummary.ts`

**Interfaces:**
- `awardStatusLabel("active")` stays stable.
- `awardStatusClass("active")` keeps active awards visually distinct.

- [ ] Add a focused test that active phase-two awards use the same active label styling helpers.
- [ ] Run `npm.cmd test -- src/app/awards/awardSummary.test.ts`.
- [ ] Adjust helpers only if the test reveals a mismatch.

### Task 3: Verification And Publish

**Files:**
- All files modified above.

- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj`.
- [ ] Run `npm.cmd test -- src/app/awards/awardSummary.test.ts`.
- [ ] Run `npx.cmd eslint src/app/awards src/lib/api.ts src/lib/types.ts src/components/layout/Navbar.tsx`.
- [ ] Run `npm.cmd run build`.
- [ ] Commit with `feat: activate zone and state awards`.
- [ ] Push branch and deploy only after user approval or explicit request.
