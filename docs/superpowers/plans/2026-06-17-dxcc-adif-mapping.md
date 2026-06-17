# DXCC ADIF Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill numeric ADIF DXCC entity codes for new QSOs enriched from CTY lookup data.

**Architecture:** Keep CTY as the callsign-to-entity source and add an official ADIF DXCC entity-code CSV as the entity-name-to-code source. `DxccLookupService` loads both files, normalizes entity names, and returns the numeric code alongside country, continent, CQ zone, and ITU zone.

**Tech Stack:** ASP.NET Core service, local ADIF 3.1.7 resource CSV, xUnit.

## Global Constraints

- Do not use runtime network calls for DXCC lookup.
- Do not overwrite explicit QSO `Dxcc` values from clients/imports.
- Keep CTY callsign matching behavior unchanged.
- Use the official ADIF DXCC Entity Code enumeration as the numeric-code source.

---

### Task 1: DXCC Code Lookup

- [ ] Add failing tests that `DxccLookupService.Lookup()` returns ADIF DXCC codes for Denmark, Germany, and Aland Islands.
- [ ] Add `Data/dxcc-entity-codes.csv` from ADIF 3.1.7 resources.
- [ ] Load and normalize ADIF entity names in `DxccLookupService`.
- [ ] Return `Dxcc` in `DxccLookupResult`.

### Task 2: Created QSO Enrichment

- [ ] Update QSO create enrichment to fill missing `Dxcc`.
- [ ] Keep explicit DTO `Dxcc` unchanged.
- [ ] Ensure the CSV is copied to output/deploy.

### Task 3: Verification And Deploy

- [ ] Run backend tests.
- [ ] Run frontend award tests, lint, and build.
- [ ] Commit, push, and deploy.
