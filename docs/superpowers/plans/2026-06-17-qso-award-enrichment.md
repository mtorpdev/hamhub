# QSO Award Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich newly created QSOs with DXCC, country, continent, CQ zone, and ITU zone from HamHub's CTY lookup when clients do not provide those fields.

**Architecture:** Keep enrichment server-side in `QsosController.Create`, because WSJT-X, manual logging, and API clients all use `/api/qsos`. Add a small helper that fills only missing fields and leaves user/import-provided values intact.

**Tech Stack:** ASP.NET Core controllers, AutoMapper, EF Core in-memory tests, existing `DxccLookupService`.

## Global Constraints

- Do not infer counties from callsigns.
- Do not overwrite explicit DTO/import values.
- Use CTY lookup only for DXCC/country/continent/CQ/ITU fields.
- Keep duplicate merge behavior compatible.
- Use TDD for new behavior.

---

### Task 1: Create Endpoint Enrichment

**Files:**
- Create: `backend/HamHub.Api.Tests/QsosControllerCreateTests.cs`
- Modify: `backend/HamHub.Api/Controllers/QsosController.cs`
- Modify: controller test helpers affected by constructor changes.

- [ ] Add failing tests for create enrichment from CTY lookup.
- [ ] Add failing tests that explicit DTO values are not overwritten.
- [ ] Inject `DxccLookupService` into `QsosController`.
- [ ] Fill missing `Country`, `Dxcc`, `Continent`, `CqZone`, and `ItuZone` after callsign normalization and before duplicate detection.
- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj --filter QsosControllerCreateTests`.

### Task 2: Verification And Deploy

- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj`.
- [ ] Run `npm.cmd test -- src/app/awards/awardSummary.test.ts`.
- [ ] Run `npx.cmd eslint src/app/awards src/lib/api.ts src/lib/types.ts src/components/layout/Navbar.tsx`.
- [ ] Run `npm.cmd run build`.
- [ ] Commit with `feat: enrich created qsos for awards`.
- [ ] Push and deploy after verification.
