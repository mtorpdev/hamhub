# WSJT-X HamHub Plugin Design

## Goal

Build a background agent that bridges WSJT-X and HamHub: it listens to WSJT-X's UDP broadcast, streams decoded signals to the website in real time, and auto-logs QSOs to the user's HamHub logbook the moment they are logged in WSJT-X.

## Architecture

```
WSJT-X ──UDP:2237──► HamHub Plugin (user's PC)
                          │  HTTP
                          ▼
                     HamHub API
                     ├─ POST /api/wsjtx/decodes   batch of decoded signals
                     ├─ POST /api/qsos            auto-log a QSO
                     └─ GET  /api/wsjtx/stream    SSE push to browser
                          │
                     PostgreSQL
                     └─ WsjtxDecode (index on DecodedAt; pruned every hour)
                          │
                     Browser /decode page (live SSE)
```

## Deliverables

### 1. HamHub.WsjtxCore (class library)

Shared by both plugin distributions.

#### UdpListener

Binds a `UdpClient` to port 2237 (configurable). Binding strategy:

- **Default (unicast/broadcast):** bind to `0.0.0.0:2237`. Works out-of-the-box with WSJT-X default settings.
- **Multicast:** if `UdpMulticast` in config is non-empty (e.g. `"224.0.0.1"`), call `JoinMulticastGroup` after binding. The user must also enable multicast in WSJT-X settings (File → Settings → Reporting → UDP Server → set address to the multicast group). WSJT-X default is unicast; multicast is opt-in on both sides.

Reads datagrams in a `Task`-based loop, emits `MessageReceived(byte[])` events for the parser.

#### MessageParser

Parses WSJT-X binary protocol. All multi-byte values are **big-endian**.

**Frame header (every datagram):**
```
Magic    : uint32 = 0xADBCCBDA  (validate explicitly in big-endian before processing)
Schema   : uint32               (must be ≥ 2; record for version branching)
Type     : uint32
ID       : string
```

**String encoding:** `uint32 length` (big-endian; `0xFFFFFFFF` = null → treat as empty) + UTF-8 bytes of that length.

**QDateTime encoding:** `uint64 Julian day` + `uint32 ms-since-midnight` + `uint8 timespec` (1 = UTC). Convert to `DateTime` via `DateTime.FromOADate` or Julian day math.

**Message type 1 — Status:** `dial_freq (uint64 Hz)`, `mode (string)`, `dx_call (string)`, `report (string)`, `tx_mode (string)`, `tx_enabled (bool)`, `transmitting (bool)`, `decoding (bool)`, `rx_df (uint32)`, `tx_df (uint32)`, `de_call (string)`, `de_grid (string)`, `dx_grid (string)`, …

**Message type 2 — Decode:**
```
new (bool) | time_ms (uint32) | snr (int32) | delta_time (double) |
delta_freq_hz (uint32) | mode (string) | message (string) |
low_confidence (bool) | off_air (bool)
```

**Message type 5 — QSO Logged:**
```
time_off (QDateTime) | dx_call (string) | dx_grid (string) |
tx_freq_hz (uint64) | mode (string) | report_sent (string) |
report_received (string) | tx_power (string) | comments (string) |
name (string) | time_on (QDateTime) | operator_call (string) |
my_call (string) | my_grid (string) | exchange_sent (string) |
exchange_received (string)
```
If schema ≥ 3: `adif_prop_mode (string)` — read only if bytes remain and schema ≥ 3.

Discard any datagram whose magic ≠ `0xADBCCBDA`. Log and skip on parse errors.

#### StatusCache

Singleton dictionary: `id → LastStatus`. The parser updates it on every Status (type 1) message. When a Decode (type 2) arrives, the listener reads `StatusCache[id]` to attach `de_call` (spotter callsign) and `dial_freq_hz` (current frequency) to the decode event. If no Status has been seen yet for that `id`, `de_call` is empty string and `dial_freq_hz` is 0 — acceptable until first Status arrives.

#### HamHubApiClient

- `LoginAsync(username, password)` — POST /api/auth/login, store JWT in memory.
- `PostDecodesAsync(WsjtxDecodeDto[])` — POST /api/wsjtx/decodes. Throws on 4xx/5xx.
- `PostQsoAsync(CreateQsoDto)` — POST /api/qsos. Throws on 4xx/5xx.
- On any 401 response: call `LoginAsync` once, then retry the original request. If retry also fails, log the error and drop the payload.

#### DecodeBuffer

Collects decoded signals in a `ConcurrentQueue<WsjtxDecodeDto>`. A `PeriodicTimer` (15 s) drains the queue and calls `PostDecodesAsync`. The timer must not start until `LoginAsync` succeeds. On startup failure (login error), retry login every 30 seconds; do not start UDP listener until login succeeds.

#### Config model (`appsettings.json`)

```json
{
  "HamHub": {
    "ServerUrl": "https://api.hamhub.dk",
    "Username": "user@email.com",
    "Password": "secret",
    "UdpPort": 2237,
    "UdpMulticast": ""
  }
}
```

`UdpMulticast` empty = unicast/broadcast mode (default). Set to `"224.0.0.1"` only if WSJT-X is also configured to multicast.

---

### 2. HamHub.WsjtxService (cross-platform Worker Service)

.NET 8 Generic Host with `BackgroundService`. Reads config from `appsettings.json` next to the executable. Logs to console + rolling file (`Serilog`).

Published as self-contained single-file executables: `win-x64`, `linux-x64`, `osx-x64`.

Startup sequence (enforced in `ExecuteAsync`):
1. Validate config — error + exit if `ServerUrl`, `Username`, or `Password` is missing.
2. Call `LoginAsync`. On failure, log error and retry every 30 s in a loop.
3. Once logged in, start `UdpListener` and `DecodeBuffer` timer.
4. `CancellationToken` cancellation stops the loop and disposes resources.

---

### 3. HamHub.WsjtxTray (Windows WPF tray app)

WPF app (`net8.0-windows`). Uses **`Hardcodet.NotifyIcon.Wpf`** NuGet package for the system tray icon (WPF has no built-in `NotifyIcon`).

No main window. `App.xaml.cs` sets `ShutdownMode = OnExplicitShutdown` and creates the `TaskbarIcon`.

Tray icon states (different icon files):
- `icon-grey.ico` — not connected / starting
- `icon-green.ico` — connected, receiving decodes
- `icon-red.ico` — error (login failed, connection lost)

Context menu:
- Status label: `"Tilsluttet som OZ4MT"` (or `"Ikke tilsluttet"`)
- `"Åbn HamHub"` → `Process.Start` browser with server URL
- `"Indstillinger"` → opens `SettingsWindow` (WPF dialog)
- `"Se log"` → opens scrollable `LogWindow`
- `"Afslut"` → `Application.Current.Shutdown()`

`SettingsWindow` reads/writes `%APPDATA%\HamHub\wsjtx-agent.json`. On save, restarts the internal `HamHubApiClient` and `UdpListener`.

Shares all of `HamHub.WsjtxCore`. WPF layer only adds UI + lifecycle management.

---

## Backend Changes

### New entity: WsjtxDecode

```csharp
public class WsjtxDecode
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string SpotterCallsign { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;       // raw FT8 text
    public string? DxCallsign { get; set; }                   // parsed from message
    public string? DxGrid { get; set; }                       // parsed from message
    public int Snr { get; set; }
    public double DeltaTime { get; set; }
    public uint DeltaFreqHz { get; set; }
    public double FrequencyMhz { get; set; }
    public string Mode { get; set; } = string.Empty;
    public DateTime DecodedAt { get; set; } = DateTime.UtcNow;
}
```

EF Core index: `builder.HasIndex(d => d.DecodedAt)` in `OnModelCreating`.

Auto-prune: `WsjtxPruneService : BackgroundService` runs every 1 hour, deletes rows where `DecodedAt < UtcNow - 4h`.

### New: WsjtxBroadcaster (singleton service)

```csharp
public class WsjtxBroadcaster
{
    private readonly ConcurrentDictionary<Guid, Channel<WsjtxDecodeDto>> _clients = new();

    public IAsyncEnumerable<WsjtxDecodeDto> Subscribe(CancellationToken ct) { … }
    public void Broadcast(IEnumerable<WsjtxDecodeDto> decodes) { … }
}
```

Registered as singleton in DI. `POST /api/wsjtx/decodes` calls `Broadcast` after saving to DB. `GET /api/wsjtx/stream` calls `Subscribe` and streams items as SSE events.

### New endpoints

**POST /api/wsjtx/decodes** `[Authorize]`
- Accept `WsjtxDecodeDto[]`
- Save batch to `WsjtxDecode` table
- Call `WsjtxBroadcaster.Broadcast`
- Return 204

**GET /api/wsjtx/stream** — intentionally public (community cluster feed, like DX Summit)
- `Response.ContentType = "text/event-stream"`
- `Response.Headers["Cache-Control"] = "no-cache"`
- Subscribe to `WsjtxBroadcaster`, write `data: <json>\n\n` per item
- Send `: ping\n\n` comment every 30 s to keep connection alive
- Disconnect cleanly on `CancellationToken` cancellation

### Reuse existing

**POST /api/qsos** — plugin sends `CreateQsoDto`. Band derived from `tx_freq_hz` using the same enum mapping as the ADIF export. Mode string from WSJT-X ("FT8", "FT4", "JT65" etc.) mapped to `Mode` enum.

---

## Frontend Changes

### New: `/decode` page

SSE consumer using `EventSource`. On mount, opens `new EventSource('/api/wsjtx/stream')`. On each `message` event, prepends the decode to a capped array (max 200 rows; oldest drop off top).

Columns: Time, Callsign, Grid, SNR (coloured: green ≥ 0, yellow -10 to 0, red < -10), Freq (MHz), Mode, Message, Spotter.

Features:
- `✓ Worked` green badge if callsign is in the user's QSO logbook (same fetch pattern as spots page)
- Filter bar: All / FT8 / FT4
- Auto-scroll toggle (checkbox, default on)
- Row count badge: `"247 decodes"`
- `EventSource` reconnects automatically on disconnect (browser built-in)

---

## Future: WSJT-X Remote Actions from Live Decodes

### Goal

Extend the current one-way WSJT-X bridge into a two-way control loop so a logged-in HamHub user can act on decodes from the `/decode` page:

- Click a decoded CQ to prepare a reply in WSJT-X.
- Click a decoded station to set the DX callsign/frequency in WSJT-X.
- Start a CQ session from HamHub with an explicit user action.

Current flow:

```
WSJT-X -> local HamHub agent -> HamHub API -> /decode page
```

Required future flow:

```
/decode page -> HamHub API -> local HamHub agent -> WSJT-X UDP command
```

### UX

On the `/decode` page:

- Add an action button on eligible rows, e.g. `Svar` for `CQ ...` messages and `Kald` for direct station messages.
- Add a top-level `Start CQ` action.
- Show command state per row/action: idle, sending, sent, failed.
- Disable actions when no local agent is connected for the current user.
- For TX-related actions, require an explicit confirmation before anything can enable transmission.

Recommended first release:

- Implement `Prepare reply` only: set DX callsign/grid and target audio frequency in WSJT-X.
- Do not start TX automatically.

Later release:

- Add `Start CQ` and optional TX enable, guarded by a confirmation and clear state in the UI.

### Backend

Add a per-user command channel/queue for the local agent.

Suggested endpoints:

```http
POST /api/wsjtx/commands
GET  /api/wsjtx/commands/stream
POST /api/wsjtx/commands/{id}/ack
```

`POST /api/wsjtx/commands` accepts commands from the web UI:

```json
{
  "type": "prepare-reply",
  "decodeId": 123,
  "dxCallsign": "OZ1ABC",
  "dxGrid": "JO65",
  "frequencyMhz": 14.074,
  "deltaFreqHz": 1240,
  "message": "CQ OZ1ABC JO65"
}
```

`GET /api/wsjtx/commands/stream` is consumed by the local agent after authentication. It should only stream commands for the authenticated user.

`POST /api/wsjtx/commands/{id}/ack` lets the agent report `accepted`, `completed`, or `failed`, including an optional error message. The UI can subscribe to command status updates or poll command status.

### Local Agent

The agent must be extended from a listener/uploader into a bidirectional bridge:

- Keep the existing UDP listener for WSJT-X Status, Decode, and QSO Logged messages.
- Maintain an authenticated connection to `GET /api/wsjtx/commands/stream`.
- Convert HamHub command DTOs into WSJT-X UDP command datagrams.
- Send command datagrams to the local WSJT-X UDP server.
- Ack command results back to HamHub.

The agent should expose connection state to HamHub, for example:

- connected/disconnected
- WSJT-X heard recently
- last status timestamp
- station callsign/grid
- current band/mode/frequency

This lets the web UI avoid showing control actions when the local agent or WSJT-X is unavailable.

### WSJT-X Safety Rules

HamHub must be conservative around transmit control:

- Never enable TX silently.
- Never start a CQ or reply from a row click without an explicit user action.
- Prefer preparing WSJT-X state first, then let the operator start/confirm transmit in WSJT-X.
- Any future `start-cq` or `enable-tx` command must require a visible confirmation in HamHub.
- The UI must clearly show whether a command only prepared WSJT-X or actually requested transmit.

### Command Types

Initial command set:

- `prepare-reply`: set DX callsign/grid and target frequency/DF in WSJT-X from a selected decode.
- `prepare-call`: set DX callsign/frequency for a non-CQ decode.

Future command set:

- `start-cq`: start a CQ sequence using current band/mode settings.
- `halt-tx`: stop transmit/request halt.
- `clear-dx`: clear active DX target in WSJT-X.

### Implementation Notes

This feature depends on the WSJT-X UDP command side of the protocol, not only the broadcast messages already parsed by `MessageParser`.

Before implementation, add protocol-level tests for binary command serialization in `HamHub.WsjtxCore`, similar to the existing parse-side tests that should cover incoming WSJT-X datagrams.

---

## Tech Stack

- .NET 8, C#
- WPF + `Hardcodet.NotifyIcon.Wpf` (tray app)
- `Microsoft.Extensions.Hosting` (worker service + tray app host)
- `System.Net.Sockets.UdpClient` (UDP)
- `System.Threading.Channels` (SSE fan-out)
- `Serilog` (logging in service)
- ASP.NET Core response streaming (SSE — no SignalR needed)
- EF Core + Npgsql (WsjtxDecode table)
- Next.js `EventSource` API (SSE client)

---

## Out of Scope

- Radio CAT control
- Waterfall display
- Automatic transmit without explicit operator confirmation
- Installer / auto-update (user downloads zip, extracts, runs)
- WSPR decode support (type 10) — future work
