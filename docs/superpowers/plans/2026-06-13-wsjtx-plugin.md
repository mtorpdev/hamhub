# WSJT-X Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete WSJT-X bridge: backend SSE infrastructure, live /decode frontend page, cross-platform Worker Service, and Windows WPF tray app — all sharing a core library that parses WSJT-X UDP datagrams.

**Architecture:** WSJT-X sends UDP datagrams to port 2237. The plugin (running on the user's PC) parses them using `HamHub.WsjtxCore`, batches decodes every 15 s, and POSTs them to `POST /api/wsjtx/decodes`. The backend fans decoded signals out via `WsjtxBroadcaster` (Channels) to SSE clients on `GET /api/wsjtx/stream`. QSO Logged messages (type 5) are immediately forwarded to `POST /api/qsos`.

**Tech Stack:** .NET 8 / ASP.NET Core, EF Core + Npgsql, System.Threading.Channels (SSE fan-out), System.Net.Sockets.UdpClient, WPF + Hardcodet.NotifyIcon.Wpf, Next.js EventSource API

---

## File Map

### Backend (HamHub.Api / HamHub.Domain / HamHub.Application / HamHub.Infrastructure)

| File | Action | Responsibility |
|---|---|---|
| `HamHub.Domain/Entities/WsjtxDecode.cs` | Create | Entity definition |
| `HamHub.Infrastructure/Persistence/Configurations/WsjtxDecodeConfiguration.cs` | Create | EF Core config + index |
| `HamHub.Infrastructure/Persistence/ApplicationDbContext.cs` | Modify | Add `DbSet<WsjtxDecode>` |
| `HamHub.Application/Wsjtx/DTOs/WsjtxDecodeDto.cs` | Create | DTO + CreateDto |
| `HamHub.Application/Common/Mappings/MappingProfile.cs` | Modify | Add `WsjtxDecode → WsjtxDecodeDto` map |
| `HamHub.Api/Services/WsjtxBroadcaster.cs` | Create | Channel-based SSE fan-out singleton |
| `HamHub.Api/Services/WsjtxPruneService.cs` | Create | Hourly prune BackgroundService |
| `HamHub.Api/Controllers/WsjtxController.cs` | Create | POST /api/wsjtx/decodes + GET /api/wsjtx/stream |
| `HamHub.Api/Program.cs` | Modify | Register broadcaster + prune service |
| `HamHub.Infrastructure/Migrations/` | Generate | `dotnet ef migrations add AddWsjtxDecodes` |

### Frontend

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/lib/types.ts` | Modify | Add `WsjtxDecodeItem` interface |
| `frontend/src/lib/api.ts` | Modify | (no change needed — SSE uses EventSource directly) |
| `frontend/src/app/decode/page.tsx` | Create | Live decode page with SSE EventSource |

### Plugin Projects (new .NET projects in `backend/`)

| File | Action | Responsibility |
|---|---|---|
| `HamHub.WsjtxCore/HamHub.WsjtxCore.csproj` | Create | Class library project |
| `HamHub.WsjtxCore/Models/WsjtxDecodeDto.cs` | Create | Shared DTO (mirrors backend) |
| `HamHub.WsjtxCore/Models/WsjtxQsoDto.cs` | Create | Shared QSO DTO |
| `HamHub.WsjtxCore/Models/HamHubConfig.cs` | Create | Config model |
| `HamHub.WsjtxCore/MessageParser.cs` | Create | WSJT-X binary parser |
| `HamHub.WsjtxCore/StatusCache.cs` | Create | id → LastStatus dictionary |
| `HamHub.WsjtxCore/DecodeBuffer.cs` | Create | ConcurrentQueue + 15s drain timer |
| `HamHub.WsjtxCore/UdpListener.cs` | Create | UdpClient loop + MessageReceived event |
| `HamHub.WsjtxCore/HamHubApiClient.cs` | Create | HTTP client with JWT + retry |
| `HamHub.WsjtxService/HamHub.WsjtxService.csproj` | Create | Worker Service project |
| `HamHub.WsjtxService/Worker.cs` | Create | BackgroundService orchestrator |
| `HamHub.WsjtxService/appsettings.json` | Create | Default config |
| `HamHub.WsjtxTray/HamHub.WsjtxTray.csproj` | Create | WPF tray app project |
| `HamHub.WsjtxTray/App.xaml` + `App.xaml.cs` | Create | WPF app, ShutdownMode=OnExplicitShutdown |
| `HamHub.WsjtxTray/TrayOrchestrator.cs` | Create | WPF lifecycle + icon state management |
| `HamHub.WsjtxTray/SettingsWindow.xaml` + `.cs` | Create | Settings dialog |
| `HamHub.WsjtxTray/LogWindow.xaml` + `.cs` | Create | Scrollable log viewer |
| `HamHub.WsjtxTray/Resources/` | Create | icon-grey.ico, icon-green.ico, icon-red.ico |

---

## Task 1: WsjtxDecode entity + EF Core config

**Files:**
- Create: `HamHub.Domain/Entities/WsjtxDecode.cs`
- Create: `HamHub.Infrastructure/Persistence/Configurations/WsjtxDecodeConfiguration.cs`
- Modify: `HamHub.Infrastructure/Persistence/ApplicationDbContext.cs`

- [ ] **Step 1: Create the entity**

```csharp
// HamHub.Domain/Entities/WsjtxDecode.cs
namespace HamHub.Domain.Entities;

public class WsjtxDecode
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string SpotterCallsign { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? DxCallsign { get; set; }
    public string? DxGrid { get; set; }
    public int Snr { get; set; }
    public double DeltaTime { get; set; }
    public uint DeltaFreqHz { get; set; }
    public double FrequencyMhz { get; set; }
    public string Mode { get; set; } = string.Empty;
    public DateTime DecodedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Create EF Core configuration**

```csharp
// HamHub.Infrastructure/Persistence/Configurations/WsjtxDecodeConfiguration.cs
using HamHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamHub.Infrastructure.Persistence.Configurations;

public class WsjtxDecodeConfiguration : IEntityTypeConfiguration<WsjtxDecode>
{
    public void Configure(EntityTypeBuilder<WsjtxDecode> builder)
    {
        builder.HasKey(d => d.Id);
        builder.Property(d => d.UserId).HasMaxLength(450).IsRequired();
        builder.Property(d => d.SpotterCallsign).HasMaxLength(20);
        builder.Property(d => d.Message).HasMaxLength(30).IsRequired();
        builder.Property(d => d.DxCallsign).HasMaxLength(20);
        builder.Property(d => d.DxGrid).HasMaxLength(10);
        builder.Property(d => d.Mode).HasMaxLength(10);

        builder.HasIndex(d => d.DecodedAt);
    }
}
```

- [ ] **Step 3: Add DbSet to ApplicationDbContext**

In `HamHub.Infrastructure/Persistence/ApplicationDbContext.cs`, add after the `ArticleComments` line:
```csharp
public DbSet<WsjtxDecode> WsjtxDecodes => Set<WsjtxDecode>();
```

- [ ] **Step 4: Generate + apply migration**

```bash
cd D:/hamhub/backend
dotnet ef migrations add AddWsjtxDecodes --project HamHub.Infrastructure --startup-project HamHub.Api
dotnet ef database update --project HamHub.Infrastructure --startup-project HamHub.Api
```

Expected: Migration files created in `HamHub.Infrastructure/Migrations/`, database updated with `WsjtxDecodes` table.

- [ ] **Step 5: Build to verify no compile errors**

```bash
cd D:/hamhub/backend
dotnet build HamHub.Api
```

Expected: `Build succeeded.`

- [ ] **Step 6: Commit**

```bash
cd D:/hamhub/backend
git add HamHub.Domain/Entities/WsjtxDecode.cs HamHub.Infrastructure/Persistence/Configurations/WsjtxDecodeConfiguration.cs HamHub.Infrastructure/Persistence/ApplicationDbContext.cs HamHub.Infrastructure/Migrations/
git commit -m "feat: add WsjtxDecode entity and EF migration"
```

---

## Task 2: WsjtxDecodeDto + AutoMapper

**Files:**
- Create: `HamHub.Application/Wsjtx/DTOs/WsjtxDecodeDto.cs`
- Modify: `HamHub.Application/Common/Mappings/MappingProfile.cs`

- [ ] **Step 1: Create DTO**

```csharp
// HamHub.Application/Wsjtx/DTOs/WsjtxDecodeDto.cs
namespace HamHub.Application.Wsjtx.DTOs;

public record WsjtxDecodeDto(
    int Id,
    string SpotterCallsign,
    string Message,
    string? DxCallsign,
    string? DxGrid,
    int Snr,
    double DeltaTime,
    uint DeltaFreqHz,
    double FrequencyMhz,
    string Mode,
    DateTime DecodedAt
)
{
    public WsjtxDecodeDto() : this(0, string.Empty, string.Empty, null, null, 0, 0, 0, 0, string.Empty, default) { }
}

// Inbound from plugin
public record PostDecodeDto(
    string SpotterCallsign,
    string Message,
    string? DxCallsign,
    string? DxGrid,
    int Snr,
    double DeltaTime,
    uint DeltaFreqHz,
    double FrequencyMhz,
    string Mode,
    DateTime DecodedAt
);
```

- [ ] **Step 2: Add AutoMapper mapping in MappingProfile.cs**

Add to the `MappingProfile` constructor (after the existing maps):
```csharp
using HamHub.Application.Wsjtx.DTOs;
// ...
CreateMap<WsjtxDecode, WsjtxDecodeDto>();
CreateMap<PostDecodeDto, WsjtxDecode>();
```

Also add the using at the top of MappingProfile.cs.

- [ ] **Step 3: Build**

```bash
cd D:/hamhub/backend
dotnet build HamHub.Application
```

Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add HamHub.Application/Wsjtx/ HamHub.Application/Common/Mappings/MappingProfile.cs
git commit -m "feat: add WsjtxDecodeDto and AutoMapper mapping"
```

---

## Task 3: WsjtxBroadcaster singleton

**Files:**
- Create: `HamHub.Api/Services/WsjtxBroadcaster.cs`

- [ ] **Step 1: Create the broadcaster**

```csharp
// HamHub.Api/Services/WsjtxBroadcaster.cs
using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using HamHub.Application.Wsjtx.DTOs;

namespace HamHub.Api.Services;

public class WsjtxBroadcaster
{
    private readonly ConcurrentDictionary<Guid, Channel<WsjtxDecodeDto>> _clients = new();

    public async IAsyncEnumerable<WsjtxDecodeDto> Subscribe(
        [EnumeratorCancellation] CancellationToken ct)
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateUnbounded<WsjtxDecodeDto>(
            new UnboundedChannelOptions { SingleReader = true });
        _clients[id] = channel;
        try
        {
            await foreach (var item in channel.Reader.ReadAllAsync(ct))
                yield return item;
        }
        finally
        {
            _clients.TryRemove(id, out _);
        }
    }

    public void Broadcast(IEnumerable<WsjtxDecodeDto> decodes)
    {
        var list = decodes.ToList();
        foreach (var (_, channel) in _clients)
            foreach (var decode in list)
                channel.Writer.TryWrite(decode);
    }
}
```

- [ ] **Step 2: Build**

```bash
cd D:/hamhub/backend
dotnet build HamHub.Api
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add HamHub.Api/Services/WsjtxBroadcaster.cs
git commit -m "feat: add WsjtxBroadcaster SSE fan-out singleton"
```

---

## Task 4: WsjtxPruneService

**Files:**
- Create: `HamHub.Api/Services/WsjtxPruneService.cs`

- [ ] **Step 1: Create the prune service**

```csharp
// HamHub.Api/Services/WsjtxPruneService.cs
using HamHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Services;

public class WsjtxPruneService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<WsjtxPruneService> _logger;

    public WsjtxPruneService(IServiceScopeFactory scopeFactory, ILogger<WsjtxPruneService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var cutoff = DateTime.UtcNow - TimeSpan.FromHours(4);
                var deleted = await db.WsjtxDecodes
                    .Where(d => d.DecodedAt < cutoff)
                    .ExecuteDeleteAsync(stoppingToken);
                if (deleted > 0)
                    _logger.LogInformation("Pruned {Count} old WSJT-X decodes", deleted);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pruning WSJT-X decodes");
            }
        }
    }
}
```

- [ ] **Step 2: Build**

```bash
dotnet build HamHub.Api
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add HamHub.Api/Services/WsjtxPruneService.cs
git commit -m "feat: add WsjtxPruneService hourly prune BackgroundService"
```

---

## Task 5: WsjtxController

**Files:**
- Create: `HamHub.Api/Controllers/WsjtxController.cs`

- [ ] **Step 1: Create the controller**

```csharp
// HamHub.Api/Controllers/WsjtxController.cs
using System.Text.Json;
using AutoMapper;
using HamHub.Api.Services;
using HamHub.Application.Wsjtx.DTOs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/wsjtx")]
public class WsjtxController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IMapper _mapper;
    private readonly WsjtxBroadcaster _broadcaster;

    public WsjtxController(ApplicationDbContext db, IMapper mapper, WsjtxBroadcaster broadcaster)
    {
        _db = db;
        _mapper = mapper;
        _broadcaster = broadcaster;
    }

    // POST /api/wsjtx/decodes  [Authorize]
    [HttpPost("decodes")]
    [Authorize]
    public async Task<IActionResult> PostDecodes([FromBody] PostDecodeDto[] dtos)
    {
        if (dtos.Length == 0) return NoContent();

        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty;

        var entities = dtos.Select(dto =>
        {
            var e = _mapper.Map<WsjtxDecode>(dto);
            e.UserId = userId;
            return e;
        }).ToList();

        _db.WsjtxDecodes.AddRange(entities);
        await _db.SaveChangesAsync();

        var outDtos = _mapper.Map<List<WsjtxDecodeDto>>(entities);
        _broadcaster.Broadcast(outDtos);

        return NoContent();
    }

    // GET /api/wsjtx/stream  — intentionally public (community feed)
    [HttpGet("stream")]
    public async Task StreamDecodes(CancellationToken ct)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        using var pingTimer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        var pingTask = Task.Run(async () =>
        {
            while (await pingTimer.WaitForNextTickAsync(ct))
            {
                await Response.WriteAsync(": ping\n\n", ct);
                await Response.Body.FlushAsync(ct);
            }
        }, ct);

        await foreach (var decode in _broadcaster.Subscribe(ct))
        {
            var json = JsonSerializer.Serialize(decode, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            await Response.WriteAsync($"data: {json}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
    }
}
```

- [ ] **Step 2: Build**

```bash
cd D:/hamhub/backend
dotnet build HamHub.Api
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add HamHub.Api/Controllers/WsjtxController.cs
git commit -m "feat: add WsjtxController with POST /api/wsjtx/decodes and GET /api/wsjtx/stream"
```

---

## Task 6: Register services in Program.cs + verify backend

**Files:**
- Modify: `HamHub.Api/Program.cs`

- [ ] **Step 1: Add singleton + hosted service registrations**

In `Program.cs`, add after `builder.Services.AddAuthorization()`:
```csharp
builder.Services.AddSingleton<HamHub.Api.Services.WsjtxBroadcaster>();
builder.Services.AddHostedService<HamHub.Api.Services.WsjtxPruneService>();
```

- [ ] **Step 2: Build**

```bash
cd D:/hamhub/backend
dotnet build HamHub.Api
```

Expected: `Build succeeded.`

- [ ] **Step 3: Run backend and smoke test SSE endpoint**

Start the backend:
```bash
cd D:/hamhub/backend
dotnet run --project HamHub.Api &
sleep 3
curl -N https://api.hamhub.dk/api/wsjtx/stream
```

Expected: Response with `Content-Type: text/event-stream`, then `: ping` every 30 s. Press Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add HamHub.Api/Program.cs
git commit -m "feat: register WsjtxBroadcaster and WsjtxPruneService in DI"
```

---

## Task 7: Frontend /decode page

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Create: `frontend/src/app/decode/page.tsx`

- [ ] **Step 1: Add WsjtxDecodeItem type**

In `frontend/src/lib/types.ts`, add at the end:
```typescript
export interface WsjtxDecodeItem {
  id: number
  spotterCallsign: string
  message: string
  dxCallsign: string | null
  dxGrid: string | null
  snr: number
  deltaTime: number
  deltaFreqHz: number
  frequencyMhz: number
  mode: string
  decodedAt: string
}
```

- [ ] **Step 2: Create the /decode page**

```typescript
// frontend/src/app/decode/page.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import type { WsjtxDecodeItem } from '@/lib/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'
const MAX_ROWS = 200

function snrColor(snr: number) {
  if (snr >= 0) return 'text-green-400'
  if (snr >= -10) return 'text-yellow-400'
  return 'text-red-400'
}

export default function DecodePage() {
  const [decodes, setDecodes] = useState<WsjtxDecodeItem[]>([])
  const [filter, setFilter] = useState<'all' | 'FT8' | 'FT4'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [workedCallsigns, setWorkedCallsigns] = useState<Set<string>>(new Set())
  const { isAuthenticated } = useAuth()
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isAuthenticated) {
      api.qsos.getMine().then(qsos => {
        setWorkedCallsigns(new Set(qsos.map(q => q.workedCallsign.toUpperCase())))
      }).catch(() => {})
    }
  }, [isAuthenticated])

  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/wsjtx/stream`)
    es.onmessage = (e) => {
      const decode: WsjtxDecodeItem = JSON.parse(e.data)
      setDecodes(prev => {
        const next = [decode, ...prev]
        return next.length > MAX_ROWS ? next.slice(0, MAX_ROWS) : next
      })
    }
    es.onerror = () => {} // browser auto-reconnects
    return () => es.close()
  }, [])

  useEffect(() => {
    if (autoScroll && tableRef.current) {
      tableRef.current.scrollTop = 0
    }
  }, [decodes, autoScroll])

  const visible = filter === 'all' ? decodes : decodes.filter(d => d.mode === filter)

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Live Decodes</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SSE live
          </span>
          <Badge variant="info">{decodes.length} decodes</Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 border-b border-gray-700">
          {(['all', 'FT8', 'FT4'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${filter === f ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              {f === 'all' ? 'Alle' : f}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            className="accent-blue-500"
          />
          Auto-scroll
        </label>
      </div>

      <Card>
        <CardContent className="p-0">
          <div ref={tableRef} className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 sticky top-0 z-10">
                <tr>
                  {['Tid', 'Kaldesignal', 'Grid', 'SNR', 'Freq (MHz)', 'Mode', 'Besked', 'Spotter'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {visible.map(d => (
                  <tr key={d.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap font-mono">
                      {new Date(d.decodedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-white whitespace-nowrap">
                      {d.dxCallsign ?? '—'}
                      {isAuthenticated && d.dxCallsign && workedCallsigns.has(d.dxCallsign.toUpperCase()) && (
                        <span className="ml-2 text-xs bg-green-800 text-green-300 border border-green-700 px-1.5 py-0.5 rounded">✓ Worked</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-400 font-mono">{d.dxGrid ?? '—'}</td>
                    <td className={`px-3 py-2 font-mono font-bold ${snrColor(d.snr)}`}>{d.snr > 0 ? `+${d.snr}` : d.snr}</td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{d.frequencyMhz.toFixed(3)}</td>
                    <td className="px-3 py-2"><Badge>{d.mode}</Badge></td>
                    <td className="px-3 py-2 text-gray-400 font-mono max-w-xs truncate">{d.message}</td>
                    <td className="px-3 py-2 text-gray-500 font-mono">{d.spotterCallsign}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="p-6 text-gray-500 text-center">
                Ingen decodes endnu. Vent på at WSJT-X sender data via plugin'et.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Add nav link to /decode page**

Find the navigation component (likely `frontend/src/components/Nav.tsx` or `layout.tsx`) and add a link to `/decode` labeled `"Live Decodes"`.

- [ ] **Step 4: Build the frontend**

```bash
cd D:/hamhub/frontend
npm run build
```

Expected: `Compiled successfully.` (or equivalent Next.js success message)

- [ ] **Step 5: Commit**

```bash
cd D:/hamhub/frontend
git add src/lib/types.ts src/app/decode/
git commit -m "feat: add /decode page with live SSE EventSource and worked badge"
```

---

## Task 8: HamHub.WsjtxCore — project scaffold + models

**Files:**
- Create: `HamHub.WsjtxCore/HamHub.WsjtxCore.csproj`
- Create: `HamHub.WsjtxCore/Models/WsjtxDecodeDto.cs`
- Create: `HamHub.WsjtxCore/Models/WsjtxQsoDto.cs`
- Create: `HamHub.WsjtxCore/Models/HamHubConfig.cs`
- Modify: `HamHub.slnx` (add project)

- [ ] **Step 1: Create the class library project**

```bash
cd D:/hamhub/backend
dotnet new classlib -n HamHub.WsjtxCore -f net8.0
```

Expected: `HamHub.WsjtxCore/` directory created with `.csproj` and `Class1.cs`.

Delete the placeholder `Class1.cs`:
```bash
rm D:/hamhub/backend/HamHub.WsjtxCore/Class1.cs
```

- [ ] **Step 2: Add to solution**

```bash
cd D:/hamhub/backend
dotnet sln HamHub.slnx add HamHub.WsjtxCore/HamHub.WsjtxCore.csproj
```

- [ ] **Step 3: Add required NuGet packages**

```bash
cd D:/hamhub/backend/HamHub.WsjtxCore
dotnet add package Microsoft.Extensions.Hosting.Abstractions
dotnet add package Microsoft.Extensions.Http
dotnet add package Microsoft.Extensions.Logging.Abstractions
```

- [ ] **Step 4: Create the shared DTO models**

```csharp
// HamHub.WsjtxCore/Models/WsjtxDecodeDto.cs
namespace HamHub.WsjtxCore.Models;

public record WsjtxDecodeDto(
    string SpotterCallsign,
    string Message,
    string? DxCallsign,
    string? DxGrid,
    int Snr,
    double DeltaTime,
    uint DeltaFreqHz,
    double FrequencyMhz,
    string Mode,
    DateTime DecodedAt
);
```

```csharp
// HamHub.WsjtxCore/Models/WsjtxQsoDto.cs
namespace HamHub.WsjtxCore.Models;

public record WsjtxQsoDto(
    DateTime DateUtc,
    string OwnCallsign,
    string WorkedCallsign,
    double FrequencyMhz,
    string Mode,
    string? RstSent,
    string? RstReceived,
    string? Locator,
    string? Notes
);
```

```csharp
// HamHub.WsjtxCore/Models/HamHubConfig.cs
namespace HamHub.WsjtxCore.Models;

public class HamHubConfig
{
    public string ServerUrl { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public int UdpPort { get; set; } = 2237;
    public string UdpMulticast { get; set; } = string.Empty;
}
```

- [ ] **Step 5: Build**

```bash
cd D:/hamhub/backend
dotnet build HamHub.WsjtxCore
```

Expected: `Build succeeded.`

- [ ] **Step 6: Commit**

```bash
cd D:/hamhub/backend
git add HamHub.WsjtxCore/ HamHub.slnx
git commit -m "feat: scaffold HamHub.WsjtxCore class library with shared models"
```

---

## Task 9: HamHub.WsjtxCore — MessageParser + StatusCache

**Files:**
- Create: `HamHub.WsjtxCore/StatusCache.cs`
- Create: `HamHub.WsjtxCore/MessageParser.cs`

- [ ] **Step 1: Create StatusCache**

```csharp
// HamHub.WsjtxCore/StatusCache.cs
using System.Collections.Concurrent;

namespace HamHub.WsjtxCore;

public class StatusEntry
{
    public string DeCall { get; set; } = string.Empty;
    public ulong DialFreqHz { get; set; }
    public string Mode { get; set; } = string.Empty;
}

public class StatusCache
{
    private readonly ConcurrentDictionary<string, StatusEntry> _cache = new();

    public void Update(string id, StatusEntry entry) => _cache[id] = entry;

    public StatusEntry Get(string id) =>
        _cache.TryGetValue(id, out var entry) ? entry : new StatusEntry();
}
```

- [ ] **Step 2: Create MessageParser**

The parser reads WSJT-X binary datagrams. All integers are big-endian. Strings are `uint32 length` (0xFFFFFFFF = null → empty) + UTF-8 bytes. QDateTime is `uint64 Julian day` + `uint32 ms-since-midnight` + `uint8 timespec`.

```csharp
// HamHub.WsjtxCore/MessageParser.cs
using System.Buffers.Binary;
using System.Text;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxCore;

public class ParsedDecode
{
    public string Id { get; set; } = string.Empty;
    public uint Schema { get; set; }
    public bool IsNew { get; set; }
    public uint TimeMs { get; set; }
    public int Snr { get; set; }
    public double DeltaTime { get; set; }
    public uint DeltaFreqHz { get; set; }
    public string Mode { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool LowConfidence { get; set; }
    public bool OffAir { get; set; }
}

public class ParsedQsoLogged
{
    public string Id { get; set; } = string.Empty;
    public uint Schema { get; set; }
    public DateTime TimeOff { get; set; }
    public string DxCall { get; set; } = string.Empty;
    public string DxGrid { get; set; } = string.Empty;
    public ulong TxFreqHz { get; set; }
    public string Mode { get; set; } = string.Empty;
    public string ReportSent { get; set; } = string.Empty;
    public string ReportReceived { get; set; } = string.Empty;
    public string TxPower { get; set; } = string.Empty;
    public string Comments { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime TimeOn { get; set; }
    public string OperatorCall { get; set; } = string.Empty;
    public string MyCall { get; set; } = string.Empty;
    public string MyGrid { get; set; } = string.Empty;
    public string ExchangeSent { get; set; } = string.Empty;
    public string ExchangeReceived { get; set; } = string.Empty;
    public string? AdifPropMode { get; set; }
}

public class MessageParser
{
    private const uint Magic = 0xADBCCBDA;
    private readonly ILogger<MessageParser> _logger;
    private readonly StatusCache _statusCache;

    public event EventHandler<ParsedDecode>? DecodeReceived;
    public event EventHandler<ParsedQsoLogged>? QsoLoggedReceived;

    public MessageParser(ILogger<MessageParser> logger, StatusCache statusCache)
    {
        _logger = logger;
        _statusCache = statusCache;
    }

    public void Parse(byte[] data)
    {
        try
        {
            var span = data.AsSpan();
            int pos = 0;

            var magic = ReadUInt32(span, ref pos);
            if (magic != Magic) return; // not WSJT-X

            var schema = ReadUInt32(span, ref pos);
            if (schema < 2) return;

            var type = ReadUInt32(span, ref pos);
            var id = ReadString(span, ref pos);

            switch (type)
            {
                case 1: // Status
                    ParseStatus(span, ref pos, id, schema);
                    break;
                case 2: // Decode
                    ParseDecode(span, ref pos, id, schema);
                    break;
                case 5: // QSO Logged
                    ParseQsoLogged(span, ref pos, id, schema);
                    break;
                // other message types ignored
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to parse WSJT-X datagram");
        }
    }

    private void ParseStatus(ReadOnlySpan<byte> span, ref int pos, string id, uint schema)
    {
        // Field order per spec: dial_freq, mode, dx_call, report, tx_mode,
        // tx_enabled, transmitting, decoding, rx_df, tx_df, de_call, …
        var dialFreq = ReadUInt64(span, ref pos);
        var mode = ReadString(span, ref pos);
        ReadString(span, ref pos);  // dx_call (skip)
        ReadString(span, ref pos);  // report (skip)
        ReadString(span, ref pos);  // tx_mode (skip)
        ReadBool(span, ref pos);    // tx_enabled (skip)
        ReadBool(span, ref pos);    // transmitting (skip)
        ReadBool(span, ref pos);    // decoding (skip)
        ReadUInt32(span, ref pos);  // rx_df (skip)
        ReadUInt32(span, ref pos);  // tx_df (skip)
        var deCall = ReadString(span, ref pos); // spotter callsign

        _statusCache.Update(id, new StatusEntry
        {
            DialFreqHz = dialFreq,
            Mode = mode,
            DeCall = deCall
        });
    }

    private void ParseDecode(ReadOnlySpan<byte> span, ref int pos, string id, uint schema)
    {
        var isNew = ReadBool(span, ref pos);
        var timeMs = ReadUInt32(span, ref pos);
        var snr = ReadInt32(span, ref pos);
        var deltaTime = ReadDouble(span, ref pos);
        var deltaFreqHz = ReadUInt32(span, ref pos);
        var mode = ReadString(span, ref pos);
        var message = ReadString(span, ref pos);
        var lowConfidence = ReadBool(span, ref pos);
        var offAir = ReadBool(span, ref pos);

        DecodeReceived?.Invoke(this, new ParsedDecode
        {
            Id = id,
            Schema = schema,
            IsNew = isNew,
            TimeMs = timeMs,
            Snr = snr,
            DeltaTime = deltaTime,
            DeltaFreqHz = deltaFreqHz,
            Mode = mode,
            Message = message,
            LowConfidence = lowConfidence,
            OffAir = offAir
        });
    }

    private void ParseQsoLogged(ReadOnlySpan<byte> span, ref int pos, string id, uint schema)
    {
        var timeOff = ReadQDateTime(span, ref pos);
        var dxCall = ReadString(span, ref pos);
        var dxGrid = ReadString(span, ref pos);
        var txFreqHz = ReadUInt64(span, ref pos);
        var mode = ReadString(span, ref pos);
        var reportSent = ReadString(span, ref pos);
        var reportReceived = ReadString(span, ref pos);
        var txPower = ReadString(span, ref pos);
        var comments = ReadString(span, ref pos);
        var name = ReadString(span, ref pos);
        var timeOn = ReadQDateTime(span, ref pos);
        var operatorCall = ReadString(span, ref pos);
        var myCall = ReadString(span, ref pos);
        var myGrid = ReadString(span, ref pos);
        var exchangeSent = ReadString(span, ref pos);
        var exchangeReceived = ReadString(span, ref pos);

        string? adifPropMode = null;
        if (schema >= 3 && pos < span.Length)
            adifPropMode = ReadString(span, ref pos);

        QsoLoggedReceived?.Invoke(this, new ParsedQsoLogged
        {
            Id = id,
            Schema = schema,
            TimeOff = timeOff,
            DxCall = dxCall,
            DxGrid = dxGrid,
            TxFreqHz = txFreqHz,
            Mode = mode,
            ReportSent = reportSent,
            ReportReceived = reportReceived,
            TxPower = txPower,
            Comments = comments,
            Name = name,
            TimeOn = timeOn,
            OperatorCall = operatorCall,
            MyCall = myCall,
            MyGrid = myGrid,
            ExchangeSent = exchangeSent,
            ExchangeReceived = exchangeReceived,
            AdifPropMode = adifPropMode
        });
    }

    // --- Primitive readers (big-endian) ---

    private static uint ReadUInt32(ReadOnlySpan<byte> span, ref int pos)
    {
        var val = BinaryPrimitives.ReadUInt32BigEndian(span[pos..]);
        pos += 4;
        return val;
    }

    private static int ReadInt32(ReadOnlySpan<byte> span, ref int pos)
    {
        var val = BinaryPrimitives.ReadInt32BigEndian(span[pos..]);
        pos += 4;
        return val;
    }

    private static ulong ReadUInt64(ReadOnlySpan<byte> span, ref int pos)
    {
        var val = BinaryPrimitives.ReadUInt64BigEndian(span[pos..]);
        pos += 8;
        return val;
    }

    private static double ReadDouble(ReadOnlySpan<byte> span, ref int pos)
    {
        var val = BinaryPrimitives.ReadDoubleBigEndian(span[pos..]);
        pos += 8;
        return val;
    }

    private static bool ReadBool(ReadOnlySpan<byte> span, ref int pos)
    {
        return span[pos++] != 0;
    }

    private static string ReadString(ReadOnlySpan<byte> span, ref int pos)
    {
        var len = BinaryPrimitives.ReadUInt32BigEndian(span[pos..]);
        pos += 4;
        if (len == 0xFFFFFFFF) return string.Empty; // null
        var str = Encoding.UTF8.GetString(span[pos..(pos + (int)len)]);
        pos += (int)len;
        return str;
    }

    private static DateTime ReadQDateTime(ReadOnlySpan<byte> span, ref int pos)
    {
        // Julian day number (uint64)
        var julianDay = BinaryPrimitives.ReadUInt64BigEndian(span[pos..]);
        pos += 8;
        // ms since midnight (uint32)
        var msOfDay = BinaryPrimitives.ReadUInt32BigEndian(span[pos..]);
        pos += 4;
        // timespec (uint8): 1 = UTC
        pos += 1; // skip — treat all as UTC

        // Julian Day Number to DateTime: JDN 2440588 = 1970-01-01
        var epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var date = epoch.AddDays(julianDay - 2440588);
        return date.AddMilliseconds(msOfDay);
    }
}
```

- [ ] **Step 3: Build**

```bash
cd D:/hamhub/backend
dotnet build HamHub.WsjtxCore
```

Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add HamHub.WsjtxCore/StatusCache.cs HamHub.WsjtxCore/MessageParser.cs
git commit -m "feat: implement WSJT-X binary MessageParser and StatusCache"
```

---

## Task 10: HamHub.WsjtxCore — HamHubApiClient + DecodeBuffer + UdpListener

**Files:**
- Create: `HamHub.WsjtxCore/HamHubApiClient.cs`
- Create: `HamHub.WsjtxCore/DecodeBuffer.cs`
- Create: `HamHub.WsjtxCore/UdpListener.cs`

- [ ] **Step 1: Create HamHubApiClient**

```csharp
// HamHub.WsjtxCore/HamHubApiClient.cs
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxCore;

public class HamHubApiClient
{
    private readonly HttpClient _http;
    private readonly HamHubConfig _config;
    private readonly ILogger<HamHubApiClient> _logger;
    private string? _token;

    public HamHubApiClient(HttpClient http, HamHubConfig config, ILogger<HamHubApiClient> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
        _http.BaseAddress = new Uri(config.ServerUrl);
    }

    public async Task LoginAsync(CancellationToken ct = default)
    {
        var body = new { email = _config.Username, password = _config.Password };
        var res = await _http.PostAsJsonAsync("/api/auth/login", body, ct);
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadFromJsonAsync<JsonElement>(ct);
        _token = json.GetProperty("token").GetString() ?? throw new InvalidOperationException("No token in response");
        _logger.LogInformation("Logged in to HamHub as {Username}", _config.Username);
    }

    public async Task PostDecodesAsync(WsjtxDecodeDto[] decodes, CancellationToken ct = default)
    {
        await SendWithRetryAsync(
            () => BuildRequest(HttpMethod.Post, "/api/wsjtx/decodes", decodes),
            ct);
    }

    public async Task PostQsoAsync(WsjtxQsoDto qso, CancellationToken ct = default)
    {
        // Map WsjtxQsoDto to the CreateQsoDto shape expected by /api/qsos
        var body = new
        {
            dateUtc = qso.DateUtc,
            ownCallsign = qso.OwnCallsign,
            workedCallsign = qso.WorkedCallsign,
            frequency = qso.FrequencyMhz,
            mode = MapMode(qso.Mode),
            rstSent = qso.RstSent,
            rstReceived = qso.RstReceived,
            locator = qso.Locator,
            notes = qso.Notes
        };
        await SendWithRetryAsync(
            () => BuildRequest(HttpMethod.Post, "/api/qsos", body),
            ct);
    }

    private HttpRequestMessage BuildRequest<T>(HttpMethod method, string path, T body)
    {
        var req = new HttpRequestMessage(method, path);
        req.Content = new StringContent(
            JsonSerializer.Serialize(body),
            Encoding.UTF8,
            "application/json");
        if (_token != null)
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);
        return req;
    }

    private async Task SendWithRetryAsync(Func<HttpRequestMessage> buildReq, CancellationToken ct)
    {
        var res = await _http.SendAsync(buildReq(), ct);
        if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            _logger.LogWarning("Got 401, re-logging in...");
            await LoginAsync(ct);
            res = await _http.SendAsync(buildReq(), ct);
        }
        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadAsStringAsync(ct);
            _logger.LogError("API error {Status}: {Body}", (int)res.StatusCode, err);
        }
    }

    // Map WSJT-X mode string to backend Mode enum int
    private static int MapMode(string mode) => mode.ToUpperInvariant() switch
    {
        "FT8"  => 3,
        "FT4"  => 4,
        "CW"   => 2,
        "SSB"  => 1,
        "RTTY" => 5,
        "FM"   => 7,
        "AM"   => 8,
        _      => 3 // default FT8
    };
}
```

- [ ] **Step 2: Create DecodeBuffer**

```csharp
// HamHub.WsjtxCore/DecodeBuffer.cs
using System.Collections.Concurrent;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxCore;

public class DecodeBuffer : IDisposable
{
    private readonly ConcurrentQueue<WsjtxDecodeDto> _queue = new();
    private readonly HamHubApiClient _api;
    private readonly ILogger<DecodeBuffer> _logger;
    private PeriodicTimer? _timer;
    private Task? _drainTask;

    public DecodeBuffer(HamHubApiClient api, ILogger<DecodeBuffer> logger)
    {
        _api = api;
        _logger = logger;
    }

    public void Enqueue(WsjtxDecodeDto decode) => _queue.Enqueue(decode);

    public void Start(CancellationToken ct)
    {
        _timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        _drainTask = DrainLoopAsync(ct);
    }

    private async Task DrainLoopAsync(CancellationToken ct)
    {
        while (await _timer!.WaitForNextTickAsync(ct))
        {
            var batch = new List<WsjtxDecodeDto>();
            while (_queue.TryDequeue(out var item))
                batch.Add(item);

            if (batch.Count == 0) continue;

            try
            {
                await _api.PostDecodesAsync(batch.ToArray(), ct);
                _logger.LogDebug("Flushed {Count} decodes", batch.Count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Failed to flush decodes batch");
            }
        }
    }

    public void Dispose()
    {
        _timer?.Dispose();
    }
}
```

- [ ] **Step 3: Create UdpListener**

```csharp
// HamHub.WsjtxCore/UdpListener.cs
using System.Net;
using System.Net.Sockets;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxCore;

public class UdpListener : IDisposable
{
    private readonly HamHubConfig _config;
    private readonly ILogger<UdpListener> _logger;
    private UdpClient? _udp;

    public event EventHandler<byte[]>? MessageReceived;

    public UdpListener(HamHubConfig config, ILogger<UdpListener> logger)
    {
        _config = config;
        _logger = logger;
    }

    public void Start(CancellationToken ct)
    {
        _udp = new UdpClient();
        _udp.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
        _udp.Client.Bind(new IPEndPoint(IPAddress.Any, _config.UdpPort));

        if (!string.IsNullOrWhiteSpace(_config.UdpMulticast))
        {
            _udp.JoinMulticastGroup(IPAddress.Parse(_config.UdpMulticast));
            _logger.LogInformation("Joined multicast group {Group}", _config.UdpMulticast);
        }

        _logger.LogInformation("Listening for WSJT-X on UDP port {Port}", _config.UdpPort);
        _ = ListenLoopAsync(ct);
    }

    private async Task ListenLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var result = await _udp!.ReceiveAsync(ct);
                MessageReceived?.Invoke(this, result.Buffer);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UDP receive error");
            }
        }
    }

    public void Dispose() => _udp?.Dispose();
}
```

- [ ] **Step 4: Build**

```bash
cd D:/hamhub/backend
dotnet build HamHub.WsjtxCore
```

Expected: `Build succeeded.`

- [ ] **Step 5: Commit**

```bash
git add HamHub.WsjtxCore/HamHubApiClient.cs HamHub.WsjtxCore/DecodeBuffer.cs HamHub.WsjtxCore/UdpListener.cs
git commit -m "feat: implement HamHubApiClient, DecodeBuffer, and UdpListener in WsjtxCore"
```

---

## Task 11: HamHub.WsjtxService — Worker Service

**Files:**
- Create: `HamHub.WsjtxService/HamHub.WsjtxService.csproj`
- Create: `HamHub.WsjtxService/Worker.cs`
- Create: `HamHub.WsjtxService/Program.cs`
- Create: `HamHub.WsjtxService/appsettings.json`

- [ ] **Step 1: Create the Worker Service project**

```bash
cd D:/hamhub/backend
dotnet new worker -n HamHub.WsjtxService -f net8.0
dotnet sln HamHub.slnx add HamHub.WsjtxService/HamHub.WsjtxService.csproj
```

Delete the default `Worker.cs` that was generated (we'll replace it).

- [ ] **Step 2: Add project reference to WsjtxCore**

```bash
cd D:/hamhub/backend/HamHub.WsjtxService
dotnet add reference ../HamHub.WsjtxCore/HamHub.WsjtxCore.csproj
dotnet add package Serilog.Extensions.Hosting
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File
```

- [ ] **Step 3: Create appsettings.json**

```json
{
  "HamHub": {
    "ServerUrl": "https://api.hamhub.dk",
    "Username": "user@email.com",
    "Password": "secret",
    "UdpPort": 2237,
    "UdpMulticast": ""
  },
  "Serilog": {
    "MinimumLevel": "Information",
    "WriteTo": [
      { "Name": "Console" },
      { "Name": "File", "Args": { "path": "logs/wsjtx-agent-.log", "rollingInterval": "Day" } }
    ]
  }
}
```

- [ ] **Step 4: Create Worker.cs**

```csharp
// HamHub.WsjtxService/Worker.cs
using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Options;

namespace HamHub.WsjtxService;

public class Worker : BackgroundService
{
    private readonly HamHubConfig _config;
    private readonly HamHubApiClient _api;
    private readonly ILogger<Worker> _logger;

    public Worker(IOptions<HamHubConfig> config, HamHubApiClient api, ILogger<Worker> logger)
    {
        _config = config.Value;
        _api = api;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (string.IsNullOrWhiteSpace(_config.ServerUrl) ||
            string.IsNullOrWhiteSpace(_config.Username) ||
            string.IsNullOrWhiteSpace(_config.Password))
        {
            _logger.LogError("Missing required config: ServerUrl, Username, or Password. Exiting.");
            return;
        }

        // Login with retry
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _api.LoginAsync(stoppingToken);
                break;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Login failed, retrying in 30s...");
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        if (stoppingToken.IsCancellationRequested) return;

        using var statusCache = new StatusCache();
        using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());
        using var decodeBuffer = new DecodeBuffer(_api,
            loggerFactory.CreateLogger<DecodeBuffer>());
        using var udpListener = new UdpListener(_config,
            loggerFactory.CreateLogger<UdpListener>());

        var parser = new MessageParser(
            loggerFactory.CreateLogger<MessageParser>(),
            statusCache);

        parser.DecodeReceived += (_, decode) =>
        {
            var status = statusCache.Get(decode.Id);
            var freqMhz = status.DialFreqHz > 0
                ? (status.DialFreqHz + decode.DeltaFreqHz) / 1_000_000.0
                : decode.DeltaFreqHz / 1_000_000.0;

            // Parse DX callsign/grid from FT8 message (simple pattern: "CQ CALLSIGN GRID" or "CALLSIGN CALLSIGN REPORT")
            string? dxCall = null, dxGrid = null;
            var parts = decode.Message.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 2)
            {
                if (parts[0].Equals("CQ", StringComparison.OrdinalIgnoreCase) && parts.Length >= 3)
                {
                    dxCall = parts[1];
                    if (parts[2].Length == 4 || parts[2].Length == 6) dxGrid = parts[2];
                }
                else
                {
                    dxCall = parts[1];
                }
            }

            decodeBuffer.Enqueue(new WsjtxDecodeDto(
                SpotterCallsign: status.DeCall,
                Message: decode.Message,
                DxCallsign: dxCall,
                DxGrid: dxGrid,
                Snr: decode.Snr,
                DeltaTime: decode.DeltaTime,
                DeltaFreqHz: decode.DeltaFreqHz,
                FrequencyMhz: freqMhz,
                Mode: decode.Mode,
                DecodedAt: DateTime.UtcNow
            ));
        };

        parser.QsoLoggedReceived += async (_, qso) =>
        {
            try
            {
                await _api.PostQsoAsync(new WsjtxQsoDto(
                    DateUtc: qso.TimeOn,
                    OwnCallsign: qso.MyCall,
                    WorkedCallsign: qso.DxCall,
                    FrequencyMhz: qso.TxFreqHz / 1_000_000.0,
                    Mode: qso.Mode,
                    RstSent: qso.ReportSent,
                    RstReceived: qso.ReportReceived,
                    Locator: qso.DxGrid,
                    Notes: string.IsNullOrWhiteSpace(qso.Comments) ? null : qso.Comments
                ), stoppingToken);
                _logger.LogInformation("Auto-logged QSO with {DxCall}", qso.DxCall);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log QSO with {DxCall}", qso.DxCall);
            }
        };

        udpListener.MessageReceived += (_, data) => parser.Parse(data);

        decodeBuffer.Start(stoppingToken);
        udpListener.Start(stoppingToken);

        _logger.LogInformation("WSJT-X agent running. Press Ctrl+C to stop.");
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }
}
```

- [ ] **Step 5: Update Program.cs for the Worker Service**

Replace the generated `HamHub.WsjtxService/Program.cs`:
```csharp
// HamHub.WsjtxService/Program.cs
using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using HamHub.WsjtxService;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(new ConfigurationBuilder()
        .AddJsonFile("appsettings.json", optional: false)
        .Build())
    .CreateLogger();

var host = Host.CreateDefaultBuilder(args)
    .UseSerilog()
    .ConfigureServices((ctx, services) =>
    {
        services.Configure<HamHubConfig>(ctx.Configuration.GetSection("HamHub"));
        services.AddHttpClient<HamHubApiClient>();
        services.AddTransient<HamHubApiClient>(sp =>
        {
            var config = sp.GetRequiredService<IOptions<HamHubConfig>>().Value;
            var http = sp.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(HamHubApiClient));
            var logger = sp.GetRequiredService<ILogger<HamHubApiClient>>();
            return new HamHubApiClient(http, config, logger);
        });
        services.AddHostedService<Worker>();
    })
    .Build();

await host.RunAsync();
```

Add missing using:
```csharp
using Microsoft.Extensions.Options;
```

- [ ] **Step 6: Build**

```bash
cd D:/hamhub/backend
dotnet build HamHub.WsjtxService
```

Expected: `Build succeeded.`

- [ ] **Step 7: Commit**

```bash
git add HamHub.WsjtxService/
git commit -m "feat: implement HamHub.WsjtxService cross-platform Worker Service"
```

---

## Task 12: HamHub.WsjtxTray — Windows WPF tray app

**Files:**
- Create: `HamHub.WsjtxTray/HamHub.WsjtxTray.csproj`
- Create: `HamHub.WsjtxTray/App.xaml` + `App.xaml.cs`
- Create: `HamHub.WsjtxTray/TrayOrchestrator.cs`
- Create: `HamHub.WsjtxTray/SettingsWindow.xaml` + `SettingsWindow.xaml.cs`
- Create: `HamHub.WsjtxTray/LogWindow.xaml` + `LogWindow.xaml.cs`
- Create: `HamHub.WsjtxTray/Resources/` (icons)

- [ ] **Step 1: Create WPF project**

```bash
cd D:/hamhub/backend
dotnet new wpf -n HamHub.WsjtxTray -f net8.0-windows
dotnet sln HamHub.slnx add HamHub.WsjtxTray/HamHub.WsjtxTray.csproj
cd HamHub.WsjtxTray
dotnet add reference ../HamHub.WsjtxCore/HamHub.WsjtxCore.csproj
dotnet add package Hardcodet.NotifyIcon.Wpf
dotnet add package Microsoft.Extensions.Hosting
dotnet add package Serilog.Extensions.Hosting
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File
```

- [ ] **Step 2: Create placeholder icon files (PNG converted to ICO)**

Create three simple 16x16 ICO files in `HamHub.WsjtxTray/Resources/`:
- `icon-grey.ico` — grey circle (not connected)
- `icon-green.ico` — green circle (connected)
- `icon-red.ico` — red circle (error)

**Simplest approach:** Use any valid `.ico` file from online sources, or generate them programmatically. For a working build, you can use the same `.ico` for all three and differentiate later. Copy a valid Windows system icon:

```bash
cp "C:/Windows/System32/imageres.dll" /dev/null || true
# Use PowerShell to create minimal ICO files from system resources:
powershell -Command "
Add-Type -AssemblyName System.Drawing
function Make-Ico(\$color, \$path) {
  \$bmp = New-Object System.Drawing.Bitmap(16, 16)
  \$g = [System.Drawing.Graphics]::FromImage(\$bmp)
  \$g.Clear([System.Drawing.Color]::Transparent)
  \$brush = New-Object System.Drawing.SolidBrush(\$color)
  \$g.FillEllipse(\$brush, 2, 2, 12, 12)
  \$g.Dispose()
  \$icon = [System.Drawing.Icon]::FromHandle(\$bmp.GetHicon())
  \$stream = [System.IO.File]::Create(\$path)
  \$icon.Save(\$stream)
  \$stream.Close()
  \$bmp.Dispose()
}
Make-Ico([System.Drawing.Color]::Gray, 'D:/hamhub/backend/HamHub.WsjtxTray/Resources/icon-grey.ico')
Make-Ico([System.Drawing.Color]::Green, 'D:/hamhub/backend/HamHub.WsjtxTray/Resources/icon-green.ico')
Make-Ico([System.Drawing.Color]::Red, 'D:/hamhub/backend/HamHub.WsjtxTray/Resources/icon-red.ico')
"
```

- [ ] **Step 3: Configure .csproj to embed icons as resources**

Edit `HamHub.WsjtxTray.csproj` to add:
```xml
<ItemGroup>
  <Resource Include="Resources\icon-grey.ico" />
  <Resource Include="Resources\icon-green.ico" />
  <Resource Include="Resources\icon-red.ico" />
</ItemGroup>
```

- [ ] **Step 4: Create App.xaml**

```xml
<!-- HamHub.WsjtxTray/App.xaml -->
<Application x:Class="HamHub.WsjtxTray.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:tb="http://www.hardcodet.net/taskbar"
             ShutdownMode="OnExplicitShutdown">
    <Application.Resources>
        <tb:TaskbarIcon x:Key="TrayIcon" />
    </Application.Resources>
</Application>
```

- [ ] **Step 5: Create App.xaml.cs**

```csharp
// HamHub.WsjtxTray/App.xaml.cs
using System.Windows;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;

namespace HamHub.WsjtxTray;

public partial class App : Application
{
    private IHost? _host;
    private TrayOrchestrator? _tray;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        Log.Logger = new Serilog.LoggerConfiguration()
            .WriteTo.Console()
            .WriteTo.File("logs/wsjtx-tray-.log", rollingInterval: Serilog.RollingInterval.Day)
            .CreateLogger();

        _host = Host.CreateDefaultBuilder()
            .UseSerilog()
            .ConfigureServices((ctx, services) =>
            {
                services.Configure<HamHubConfig>(ctx.Configuration.GetSection("HamHub"));
            })
            .Build();

        _tray = new TrayOrchestrator();
        _tray.ExitRequested += (_, _) => Shutdown();
        _tray.Initialize();

        await _host.StartAsync();
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        _tray?.Dispose();
        if (_host != null)
        {
            await _host.StopAsync();
            _host.Dispose();
        }
        Log.CloseAndFlush();
        base.OnExit(e);
    }
}
```

- [ ] **Step 6: Create TrayOrchestrator.cs**

```csharp
// HamHub.WsjtxTray/TrayOrchestrator.cs
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using Hardcodet.Wpf.TaskbarNotification;
using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxTray;

public enum ConnectionState { Disconnected, Connected, Error }

public class TrayOrchestrator : IDisposable
{
    private TaskbarIcon? _trayIcon;
    private HamHubConfig _config = new();
    private HamHubApiClient? _apiClient;
    private UdpListener? _udpListener;
    private DecodeBuffer? _decodeBuffer;
    private MessageParser? _parser;
    private StatusCache? _statusCache;
    private readonly LogBuffer _logBuffer = new();
    private CancellationTokenSource _cts = new();
    private ConnectionState _state = ConnectionState.Disconnected;

    public event EventHandler? ExitRequested;

    public void Initialize()
    {
        _config = ConfigStore.Load();
        _trayIcon = new TaskbarIcon();
        UpdateIcon(ConnectionState.Disconnected);
        BuildContextMenu();
        _ = StartAsync(_cts.Token);
    }

    private void BuildContextMenu()
    {
        if (_trayIcon == null) return;
        var menu = new ContextMenu();

        var statusItem = new MenuItem { Header = GetStatusText(), IsEnabled = false };
        menu.Items.Add(statusItem);
        menu.Items.Add(new Separator());

        var openItem = new MenuItem { Header = "Abn HamHub" };
        openItem.Click += (_, _) => Process.Start(new ProcessStartInfo(_config.ServerUrl) { UseShellExecute = true });
        menu.Items.Add(openItem);

        var settingsItem = new MenuItem { Header = "Indstillinger" };
        settingsItem.Click += (_, _) =>
        {
            var win = new SettingsWindow(_config);
            if (win.ShowDialog() == true)
            {
                _config = win.Config;
                ConfigStore.Save(_config);
                _ = RestartAsync();
            }
        };
        menu.Items.Add(settingsItem);

        var logItem = new MenuItem { Header = "Se log" };
        logItem.Click += (_, _) => new LogWindow(_logBuffer).Show();
        menu.Items.Add(logItem);

        menu.Items.Add(new Separator());
        var exitItem = new MenuItem { Header = "Afslut" };
        exitItem.Click += (_, _) => ExitRequested?.Invoke(this, EventArgs.Empty);
        menu.Items.Add(exitItem);

        _trayIcon.ContextMenu = menu;
    }

    private string GetStatusText() => _state switch
    {
        ConnectionState.Connected => $"Tilsluttet som {_config.Username}",
        ConnectionState.Error => "Fejl – se log",
        _ => "Ikke tilsluttet"
    };

    private void UpdateIcon(ConnectionState state)
    {
        _state = state;
        if (_trayIcon == null) return;
        var iconPath = state switch
        {
            ConnectionState.Connected => "pack://application:,,,/Resources/icon-green.ico",
            ConnectionState.Error => "pack://application:,,,/Resources/icon-red.ico",
            _ => "pack://application:,,,/Resources/icon-grey.ico"
        };
        var uri = new Uri(iconPath, UriKind.Absolute);
        _trayIcon.Icon = new System.Drawing.Icon(Application.GetResourceStream(uri)!.Stream);
        _trayIcon.ToolTipText = GetStatusText();
        BuildContextMenu();
    }

    private async Task StartAsync(CancellationToken ct)
    {
        using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());

        // Login with retry
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var http = new System.Net.Http.HttpClient();
                _apiClient = new HamHubApiClient(http, _config, loggerFactory.CreateLogger<HamHubApiClient>());
                await _apiClient.LoginAsync(ct);
                Application.Current.Dispatcher.Invoke(() => UpdateIcon(ConnectionState.Connected));
                break;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logBuffer.Add($"[ERROR] Login failed: {ex.Message}");
                Application.Current.Dispatcher.Invoke(() => UpdateIcon(ConnectionState.Error));
                await Task.Delay(TimeSpan.FromSeconds(30), ct);
            }
        }
        if (ct.IsCancellationRequested || _apiClient == null) return;

        _statusCache = new StatusCache();
        _decodeBuffer = new DecodeBuffer(_apiClient, loggerFactory.CreateLogger<DecodeBuffer>());
        _udpListener = new UdpListener(_config, loggerFactory.CreateLogger<UdpListener>());
        _parser = new MessageParser(loggerFactory.CreateLogger<MessageParser>(), _statusCache);

        _parser.DecodeReceived += (_, decode) =>
        {
            var status = _statusCache.Get(decode.Id);
            var freqMhz = status.DialFreqHz > 0
                ? (status.DialFreqHz + decode.DeltaFreqHz) / 1_000_000.0
                : decode.DeltaFreqHz / 1_000_000.0;

            string? dxCall = null, dxGrid = null;
            var parts = decode.Message.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 2)
            {
                if (parts[0].Equals("CQ", StringComparison.OrdinalIgnoreCase) && parts.Length >= 3)
                {
                    dxCall = parts[1];
                    if (parts[2].Length == 4 || parts[2].Length == 6) dxGrid = parts[2];
                }
                else dxCall = parts[1];
            }

            _decodeBuffer.Enqueue(new WsjtxDecodeDto(
                SpotterCallsign: status.DeCall,
                Message: decode.Message,
                DxCallsign: dxCall,
                DxGrid: dxGrid,
                Snr: decode.Snr,
                DeltaTime: decode.DeltaTime,
                DeltaFreqHz: decode.DeltaFreqHz,
                FrequencyMhz: freqMhz,
                Mode: decode.Mode,
                DecodedAt: DateTime.UtcNow
            ));
            _logBuffer.Add($"[DECODE] {decode.Message} SNR={decode.Snr}");
        };

        _parser.QsoLoggedReceived += async (_, qso) =>
        {
            try
            {
                await _apiClient.PostQsoAsync(new WsjtxQsoDto(
                    DateUtc: qso.TimeOn,
                    OwnCallsign: qso.MyCall,
                    WorkedCallsign: qso.DxCall,
                    FrequencyMhz: qso.TxFreqHz / 1_000_000.0,
                    Mode: qso.Mode,
                    RstSent: qso.ReportSent,
                    RstReceived: qso.ReportReceived,
                    Locator: qso.DxGrid,
                    Notes: string.IsNullOrWhiteSpace(qso.Comments) ? null : qso.Comments
                ), ct);
                _logBuffer.Add($"[QSO] Auto-logged {qso.DxCall}");
            }
            catch (Exception ex) { _logBuffer.Add($"[ERROR] QSO log failed: {ex.Message}"); }
        };

        _udpListener.MessageReceived += (_, data) => _parser.Parse(data);
        _decodeBuffer.Start(ct);
        _udpListener.Start(ct);
    }

    private async Task RestartAsync()
    {
        _cts.Cancel();
        _cts.Dispose();
        _udpListener?.Dispose();
        _decodeBuffer?.Dispose();
        _cts = new CancellationTokenSource();
        UpdateIcon(ConnectionState.Disconnected);
        await StartAsync(_cts.Token);
    }

    public void Dispose()
    {
        _cts.Cancel();
        _cts.Dispose();
        _udpListener?.Dispose();
        _decodeBuffer?.Dispose();
        _trayIcon?.Dispose();
    }
}

// Simple circular log buffer
public class LogBuffer
{
    private readonly Queue<string> _lines = new();
    public event EventHandler<string>? LineAdded;

    public void Add(string line)
    {
        lock (_lines)
        {
            _lines.Enqueue($"{DateTime.Now:HH:mm:ss} {line}");
            while (_lines.Count > 500) _lines.Dequeue();
        }
        LineAdded?.Invoke(this, line);
    }

    public IEnumerable<string> GetAll() { lock (_lines) return _lines.ToList(); }
}
```

- [ ] **Step 7: Create ConfigStore.cs**

```csharp
// HamHub.WsjtxTray/ConfigStore.cs
using System.IO;
using System.Text.Json;
using HamHub.WsjtxCore.Models;

namespace HamHub.WsjtxTray;

public static class ConfigStore
{
    private static readonly string ConfigPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "HamHub", "wsjtx-agent.json");

    public static HamHubConfig Load()
    {
        if (!File.Exists(ConfigPath)) return new HamHubConfig();
        try
        {
            var json = File.ReadAllText(ConfigPath);
            return JsonSerializer.Deserialize<HamHubConfig>(json) ?? new HamHubConfig();
        }
        catch { return new HamHubConfig(); }
    }

    public static void Save(HamHubConfig config)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(ConfigPath)!);
        File.WriteAllText(ConfigPath, JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true }));
    }
}
```

- [ ] **Step 8: Create SettingsWindow.xaml**

```xml
<!-- HamHub.WsjtxTray/SettingsWindow.xaml -->
<Window x:Class="HamHub.WsjtxTray.SettingsWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="HamHub WSJT-X Indstillinger"
        Width="420" Height="340"
        ResizeMode="NoResize"
        WindowStartupLocation="CenterScreen">
    <Grid Margin="20">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="130"/>
            <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>

        <Label Grid.Row="0" Grid.Column="0" Content="Server URL:" VerticalAlignment="Center"/>
        <TextBox x:Name="TxtServerUrl" Grid.Row="0" Grid.Column="1" Margin="0,4"/>

        <Label Grid.Row="1" Grid.Column="0" Content="Brugernavn (email):" VerticalAlignment="Center"/>
        <TextBox x:Name="TxtUsername" Grid.Row="1" Grid.Column="1" Margin="0,4"/>

        <Label Grid.Row="2" Grid.Column="0" Content="Adgangskode:" VerticalAlignment="Center"/>
        <PasswordBox x:Name="TxtPassword" Grid.Row="2" Grid.Column="1" Margin="0,4"/>

        <Label Grid.Row="3" Grid.Column="0" Content="UDP Port:" VerticalAlignment="Center"/>
        <TextBox x:Name="TxtUdpPort" Grid.Row="3" Grid.Column="1" Margin="0,4"/>

        <Label Grid.Row="4" Grid.Column="0" Content="Multicast IP:" VerticalAlignment="Center"/>
        <TextBox x:Name="TxtMulticast" Grid.Row="4" Grid.Column="1" Margin="0,4"/>

        <StackPanel Grid.Row="6" Grid.ColumnSpan="2" Orientation="Horizontal"
                    HorizontalAlignment="Right" Margin="0,10,0,0">
            <Button Content="Annuller" Width="80" Margin="0,0,10,0" Click="Cancel_Click"/>
            <Button Content="Gem" Width="80" IsDefault="True" Click="Save_Click"/>
        </StackPanel>
    </Grid>
</Window>
```

- [ ] **Step 9: Create SettingsWindow.xaml.cs**

```csharp
// HamHub.WsjtxTray/SettingsWindow.xaml.cs
using System.Windows;
using HamHub.WsjtxCore.Models;

namespace HamHub.WsjtxTray;

public partial class SettingsWindow : Window
{
    public HamHubConfig Config { get; private set; }

    public SettingsWindow(HamHubConfig current)
    {
        InitializeComponent();
        Config = current;
        TxtServerUrl.Text = current.ServerUrl;
        TxtUsername.Text = current.Username;
        TxtPassword.Password = current.Password;
        TxtUdpPort.Text = current.UdpPort.ToString();
        TxtMulticast.Text = current.UdpMulticast;
    }

    private void Save_Click(object sender, RoutedEventArgs e)
    {
        Config = new HamHubConfig
        {
            ServerUrl = TxtServerUrl.Text.Trim(),
            Username = TxtUsername.Text.Trim(),
            Password = TxtPassword.Password,
            UdpPort = int.TryParse(TxtUdpPort.Text, out var p) ? p : 2237,
            UdpMulticast = TxtMulticast.Text.Trim()
        };
        DialogResult = true;
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) => DialogResult = false;
}
```

- [ ] **Step 10: Create LogWindow.xaml**

```xml
<!-- HamHub.WsjtxTray/LogWindow.xaml -->
<Window x:Class="HamHub.WsjtxTray.LogWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="HamHub WSJT-X Log"
        Width="700" Height="400"
        WindowStartupLocation="CenterScreen">
    <Grid>
        <ListBox x:Name="LogList"
                 FontFamily="Consolas"
                 FontSize="11"
                 Background="#1a1a1a"
                 Foreground="#cccccc"
                 BorderThickness="0"
                 ScrollViewer.HorizontalScrollBarVisibility="Auto"
                 VirtualizingPanel.IsVirtualizing="True"/>
    </Grid>
</Window>
```

- [ ] **Step 11: Create LogWindow.xaml.cs**

```csharp
// HamHub.WsjtxTray/LogWindow.xaml.cs
using System.Windows;

namespace HamHub.WsjtxTray;

public partial class LogWindow : Window
{
    private readonly LogBuffer _buffer;

    public LogWindow(LogBuffer buffer)
    {
        InitializeComponent();
        _buffer = buffer;

        foreach (var line in _buffer.GetAll())
            LogList.Items.Add(line);

        _buffer.LineAdded += (_, line) =>
        {
            Dispatcher.Invoke(() =>
            {
                LogList.Items.Add(line);
                LogList.ScrollIntoView(LogList.Items[^1]);
            });
        };
    }
}
```

- [ ] **Step 12: Build WPF project**

```bash
cd D:/hamhub/backend
dotnet build HamHub.WsjtxTray
```

Expected: `Build succeeded.`

- [ ] **Step 13: Commit**

```bash
git add HamHub.WsjtxTray/
git commit -m "feat: implement HamHub.WsjtxTray Windows WPF system tray app"
```

---

## Task 13: End-to-end smoke test with WSJT-X

- [ ] **Step 1: Ensure backend is running**

```bash
cd D:/hamhub/backend
dotnet run --project HamHub.Api
```

- [ ] **Step 2: Open the /decode page in the browser**

Open `http://localhost:3000/decode` in a browser. Confirm the SSE connection is established (check Network tab for the `stream` request showing `text/event-stream`).

- [ ] **Step 3: Run the WsjtxService with test config**

Create a test `appsettings.json` override for local testing:
```json
{
  "HamHub": {
    "ServerUrl": "https://api.hamhub.dk",
    "Username": "your-test@email.com",
    "Password": "yourpassword",
    "UdpPort": 2237,
    "UdpMulticast": "224.0.0.1"
  }
}
```

```bash
cd D:/hamhub/backend/HamHub.WsjtxService
dotnet run
```

Expected: "Logged in to HamHub as ...", then "Listening for WSJT-X on UDP port 2237".

- [ ] **Step 4: Open WSJT-X and confirm UDP is configured**

In WSJT-X: File → Settings → Reporting → UDP Server settings:
- UDP Server: `224.0.0.1` (multicast) or leave blank for unicast
- UDP Port: `2237`
- "Accept UDP requests" must be checked

Transmit / decode. Confirm decodes appear on the `/decode` page in real time.

- [ ] **Step 5: Test QSO auto-logging**

Log a QSO in WSJT-X (File → Log QSO). Confirm it appears in the HamHub logbook at `/logbook`.

---

## Task 14: Navigation link

**Files:**
- Modify: `frontend/src/components/Nav.tsx` (or equivalent navigation file)

- [ ] **Step 1: Find the navigation component**

Read the main navigation file and add a link to `/decode`.

- [ ] **Step 2: Add link**

Add `<Link href="/decode">Live Decodes</Link>` to the nav, next to the Spots link.

- [ ] **Step 3: Build and verify**

```bash
cd D:/hamhub/frontend
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Nav.tsx   # or whatever file was modified
git commit -m "feat: add Live Decodes nav link"
```

---

## Task 15: Publish self-contained executables

- [ ] **Step 1: Publish WsjtxService for all platforms**

```bash
cd D:/hamhub/backend/HamHub.WsjtxService

dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ./publish/win-x64
dotnet publish -c Release -r linux-x64 --self-contained true -p:PublishSingleFile=true -o ./publish/linux-x64
dotnet publish -c Release -r osx-x64 --self-contained true -p:PublishSingleFile=true -o ./publish/osx-x64
```

Expected: Single-file executables in each output directory.

- [ ] **Step 2: Publish WsjtxTray for Windows**

```bash
cd D:/hamhub/backend/HamHub.WsjtxTray
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ./publish/win-x64
```

- [ ] **Step 3: Verify executables exist**

```bash
ls D:/hamhub/backend/HamHub.WsjtxService/publish/win-x64/
ls D:/hamhub/backend/HamHub.WsjtxTray/publish/win-x64/
```

- [ ] **Step 4: Commit publish configs**

```bash
cd D:/hamhub/backend
git add HamHub.WsjtxService/HamHub.WsjtxService.csproj HamHub.WsjtxTray/HamHub.WsjtxTray.csproj
git commit -m "chore: configure self-contained single-file publish profiles"
```

---

## Summary

After completing all tasks:

| Deliverable | Location |
|---|---|
| Backend SSE endpoint | `GET /api/wsjtx/stream` |
| Backend decode ingest | `POST /api/wsjtx/decodes` [Authorize] |
| Live decode page | `http://localhost:3000/decode` |
| Cross-platform service | `HamHub.WsjtxService/publish/{platform}/` |
| Windows tray app | `HamHub.WsjtxTray/publish/win-x64/` |
| Core library | `HamHub.WsjtxCore/` (shared by both) |
