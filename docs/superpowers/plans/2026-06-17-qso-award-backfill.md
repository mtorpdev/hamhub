# QSO Award Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill missing award enrichment fields on existing QSOs using the same CTY/ADIF lookup path used for newly created QSOs.

**Architecture:** Extract QSO award enrichment into a scoped service shared by `QsosController.Create` and startup backfill. The backfill scans only QSOs missing at least one enrichment field and fills null values without overwriting existing data.

**Tech Stack:** ASP.NET Core scoped service, EF Core, xUnit.

## Global Constraints

- Do not overwrite existing QSO values.
- Do not infer counties or reference fields.
- Keep startup resilient: backfill failure should log a warning, not prevent the app from booting.
- Reuse the same enrichment logic for new QSOs and existing-QSO backfill.

---

### Task 1: Shared Enrichment Service

- [ ] Add failing tests for backfill enrichment and non-overwrite behavior.
- [ ] Add `QsoAwardEnrichmentService`.
- [ ] Move create-time enrichment to the service.
- [ ] Register the service in DI.

### Task 2: Startup Backfill

- [ ] Invoke backfill after schema guards and seeding.
- [ ] Log scanned/updated counts.
- [ ] Catch startup task failures as warnings.

### Task 3: Verification And Deploy

- [ ] Run backend tests.
- [ ] Run frontend award tests, lint, and build.
- [ ] Commit, push, and deploy.
