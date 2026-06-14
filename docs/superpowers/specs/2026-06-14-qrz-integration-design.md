# QRZ.com Integration Design

## Goal

Integrate QRZ.com into HamHub to provide two features: (1) real-time callsign lookup enriching QSO entry and the callsign-search page, and (2) two-way logbook synchronisation so HamHub remains the single source of truth while QRZ stays in sync.

## Architecture

```
Browser
  ├─ /profile          → PUT /api/users/me/qrz-key  (store API key)
  │                    → GET /api/qrz/status         (show sync state)
  │                    → POST /api/qrz/sync           (manual full sync)
  ├─ /logbook          → QRZ badge per row, sync toolbar button
  └─ /callsign-search  → GET /api/qrz/lookup?callsign=X (auto-enrich)

Backend
  ├─ QrzClient          (scoped)  — HTTP wrapper for QRZ XML + Logbook APIs
  ├─ QrzSyncService     (hosted)  — periodic + event-driven sync
  └─ IQrzSyncTrigger    (channel) — notifies service of new/updated QSOs

QRZ.com
  ├─ XML API   https://xmldata.qrz.com/xml/current/   (callsign lookup)
  └─ Logbook   https://logbook.qrz.com/api            (ADIF read/write)
```

## Tech Stack

- .NET 8, ASP.NET Core, EF Core + Npgsql
- `System.Threading.Channels` for event trigger
- `System.Net.Http.HttpClient` for QRZ HTTP calls
- `System.Runtime.Caching.MemoryCache` (or `IMemoryCache`) for 24h callsign cache
- Next.js frontend (existing patterns)

---

## Data Model Changes

### `ApplicationUser` — two new columns

```csharp
public string? QrzApiKey { get; set; }       // stored encrypted at-rest
public DateTime? QrzLastSyncedAt { get; set; }
```

`QrzApiKey` is the user's QRZ logbook API key (format `XXXX-XXXX-XXXX-XXXX`). It is also used for XML callsign lookups.

### `QsoEntry` — one new column

```csharp
public string? QrzId { get; set; }   // QRZ internal log record ID; null = not yet synced
```

Used for deduplication and targeted delete/update on QRZ.

### EF Migration

One migration adds the three columns. No index needed on `QrzId` (low cardinality queries only).

---

## Deduplication Strategy

When importing QSOs from QRZ, match on:
`WorkedCallsign + DateUtc (±30 s) + Mode + Band`

- Match found → compare `UpdatedAt` (add this field to `QsoEntry`); keep the newer record.
- No match → insert as new `QsoEntry` with `QrzId` populated.

`QsoEntry` gains `UpdatedAt DateTime` (set on every save).

---

## Backend Components

### `QrzCallsignDto`

```csharp
public record QrzCallsignDto(
    string Callsign,
    string? Name,
    string? Country,
    string? Grid,
    int? Dxcc,
    string? QslVia,
    string? ImageUrl,
    string? Email
);
```

### `QrzClient` (scoped, registered in DI)

```csharp
public class QrzClient
{
    Task<QrzCallsignDto?> LookupCallsignAsync(string callsign, string apiKey, CancellationToken ct);
    Task<IReadOnlyList<AdifQso>> FetchLogAsync(string apiKey, CancellationToken ct);
    Task<string> UploadQsoAsync(AdifQso qso, string apiKey, CancellationToken ct); // returns QRZ log ID
    Task DeleteQsoAsync(string qrzId, string apiKey, CancellationToken ct);
}
```

**Callsign lookup:** `GET https://xmldata.qrz.com/xml/current/?s={apiKey};callsign={call}`
Parse XML response. Cache result in `IMemoryCache` with key `qrz:call:{callsign}` for 24 hours.

**Logbook fetch:** `POST https://logbook.qrz.com/api` with body `KEY={apiKey}&ACTION=FETCH&OPTION=ALL`
Response is ADIF text; parse with a lightweight ADIF reader.

**Upload:** `POST https://logbook.qrz.com/api` with `KEY={apiKey}&ACTION=INSERT&ADIF={adif}`
Returns `LOGID=12345` on success; extract and return the ID.

**Delete:** `POST https://logbook.qrz.com/api` with `KEY={apiKey}&ACTION=DELETE&LOGIDS={qrzId}`

On HTTP error or QRZ error response: throw `QrzApiException(message)`.

### `IQrzSyncTrigger` + `QrzSyncTrigger` (singleton channel)

```csharp
public interface IQrzSyncTrigger
{
    void NotifyQsoChanged(string userId);
    IAsyncEnumerable<string> ReadAsync(CancellationToken ct);
}
```

`QsosController` calls `_trigger.NotifyQsoChanged(userId)` after every create/update.

### `QrzSyncService` (BackgroundService)

Startup: create `PeriodicTimer(15 min)`.

Two concurrent loops:
1. **Event loop** — `await foreach (userId in _trigger.ReadAsync(ct))` → call `SyncUserAsync(userId)` for immediate upload of new QSO.
2. **Periodic loop** — on each tick → fetch all users with non-null `QrzApiKey` → call `SyncUserAsync(userId)` for each.

**`SyncUserAsync(userId)`:**
1. Fetch user's `QrzApiKey`.
2. Call `QrzClient.FetchLogAsync` → parse ADIF into list of `AdifQso`.
3. For each QRZ QSO: deduplicate against DB. Insert or update (newest wins).
4. For each local QSO with `QrzId == null`: upload via `QrzClient.UploadQsoAsync`, set `QrzId`.
5. Update `QrzLastSyncedAt = UtcNow`.
6. On `QrzApiException`: log warning, abort this user's sync (try again next tick).

---

## API Endpoints

### `GET /api/qrz/lookup?callsign={call}` `[AllowAnonymous]`

- If user is authenticated and has `QrzApiKey`, use it.
- Otherwise use a system-level default key (configured in `appsettings.json` under `Qrz:DefaultApiKey`).
- Returns `QrzCallsignDto` or 404 if callsign not found.

### `GET /api/qrz/status` `[Authorize]`

Returns:
```json
{ "connected": true, "lastSyncedAt": "2026-06-14T07:23:00Z", "qrzCallsign": "OZ4MT" }
```
`connected` = user has a non-null `QrzApiKey`. `qrzCallsign` = callsign from a probe lookup.

### `POST /api/qrz/sync` `[Authorize]`

Triggers immediate full sync for the authenticated user. Waits for completion (max 30 s timeout). Returns:
```json
{ "added": 12, "updated": 3, "uploaded": 5 }
```

### `PUT /api/users/me/qrz-key` `[Authorize]`

Body: `{ "apiKey": "F82B-A8C7-8B74-82EA" }`

1. Validate format (regex `^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$`).
2. Verify against QRZ by doing a test lookup (callsign = user's own callsign).
3. Save to `ApplicationUser.QrzApiKey`.
4. Returns 200 `{ "callsign": "OZ4MT" }` or 400 with error message.

---

## Frontend Changes

### `/profile` — new "QRZ Integration" section

- API-key input (masked; shows last 4 chars: `****-****-****-82EA`)
- "Gem og verificer"-knap → calls `PUT /api/users/me/qrz-key`
- Status line: "✓ Tilsluttet som OZ4MT — Sidst synkroniseret: 14. jun 07:23"
- "Synkroniser nu"-knap → calls `POST /api/qrz/sync`, shows spinner + result toast

### `/logbook` — sync badge + toolbar

- Each row: small `QRZ ✓` green badge if `qrzId != null`
- Toolbar: "Synkroniser med QRZ"-knap with spinner

### `/callsign-search` + new QSO form

- Debounced callsign input (300 ms) → `GET /api/qrz/lookup?callsign=X`
- Auto-fills: Navn, Land, Grid, DXCC
- Shows QRZ profile picture (if `imageUrl` present) and QSL info

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| QRZ API key invalid | `PUT /api/users/me/qrz-key` returns 400 |
| QRZ down during sync | Log warning, skip user, retry next tick |
| Callsign not found | 404 from `/api/qrz/lookup` |
| Duplicate QSO on import | Newest-wins merge, no duplicate inserted |
| Upload fails for one QSO | Log error, continue with remaining QSOs |

---

## Out of Scope

- QRZ OAuth (not supported by QRZ)
- Uploading QSO confirmations / LoTW integration
- Deleting QSOs on QRZ when deleted in HamHub (one-way delete risk — omitted)
- Real-time push from QRZ (QRZ has no webhook support)
