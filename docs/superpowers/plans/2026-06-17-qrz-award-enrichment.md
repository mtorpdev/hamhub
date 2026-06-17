# QRZ Award Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use QRZ ADIF fetch data to fill missing award fields on matched local QSOs without creating duplicates or overwriting local data.

**Architecture:** Extend `AdifQso` with award reference fields, parse/export the fields in `QrzClient`, and add a focused QRZ sync merge helper that fills only null fields on local `QsoEntry` rows.

**Tech Stack:** ASP.NET Core background service, QRZ ADIF client, xUnit.

## Global Constraints

- Do not overwrite local QSO values that already exist.
- Do not infer counties or references from callsign.
- Keep duplicate matching behavior unchanged.
- Preserve QRZ upload compatibility by including award fields when local QSOs have them.

---

### Task 1: QRZ ADIF Award Fields

- [ ] Add failing tests for QRZ ADIF parsing of `CNTY`, `IOTA`, `POTA_REF`, `SOTA_REF`, and `AWARD_SUBMITTED`.
- [ ] Extend `AdifQso` and QRZ ADIF parser/build output.
- [ ] Run QRZ client tests.

### Task 2: QRZ Matched-QSO Enrichment

- [ ] Add failing tests for merge helper filling missing local fields.
- [ ] Add failing tests that merge helper preserves existing local fields.
- [ ] Apply helper when QRZ fetch matches a local QSO.
- [ ] Include new fields in QRZ upload constructors.

### Task 3: Verification And Deploy

- [ ] Run backend tests.
- [ ] Run frontend award tests, lint, and build.
- [ ] Commit, push, and deploy.
