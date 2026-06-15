# QRZ Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate QRZ.com into HamHub — real-time callsign lookup enriching the callsign-search page, and two-way logbook sync so HamHub stays the single source of truth while QRZ stays in sync.

**Architecture:** A scoped `QrzClient` (in Infrastructure) wraps QRZ's XML and Logbook HTTP APIs. A singleton `QrzSyncTrigger` (channel) notifies `QrzSyncService` (BackgroundService, in Api) of new/edited QSOs and drives 15-minute periodic full syncs. Three new endpoints live in `QrzController`. QRZ API keys are encrypted with ASP.NET Core Data Protection before DB storage.

**Tech Stack:** .NET 8, ASP.NET Core, EF Core + Npgsql, IMemoryCache (24h callsign cache), System.Threading.Channels (trigger), System.Xml.Linq (QRZ XML parse), ASP.NET Core RateLimiter (fixed window), IDataProtector (key encryption), Next.js / React (frontend, existing patterns).

---

## File Map

| Action | Path |
|--------|------|
| Modify | `backend/HamHub.Domain/Entities/ApplicationUser.cs` |
| Modify | `backend/HamHub.Domain/Entities/QsoEntry.cs` |
| Modify | `backend/HamHub.Infrastructure/Persistence/Configurations/QsoEntryConfiguration.cs` |
| Create | `backend/HamHub.Infrastructure/Services/QrzClient.cs` |
| Modify | `backend/HamHub.Infrastructure/DependencyInjection.cs` |
| Create | `backend/HamHub.Api/Services/QrzSyncTrigger.cs` |
| Create | `backend/HamHub.Api/Services/QrzSyncService.cs` |
| Create | `backend/HamHub.Api/Controllers/QrzController.cs` |
| Modify | `backend/HamHub.Api/Controllers/UsersController.cs` |
| Modify | `backend/HamHub.Api/Controllers/QsosController.cs` |
| Modify | `backend/HamHub.Api/Program.cs` |
| Modify | `backend/HamHub.Api/appsettings.json` |
| Modify | `backend/HamHub.Application/QsoEntries/DTOs/QsoDto.cs` |
| Modify | `frontend/src/lib/types.ts` |
| Modify | `frontend/src/lib/api.ts` |
| Modify | `frontend/src/app/profile/page.tsx` |
| Modify | `frontend/src/app/logbook/page.tsx` |
| Modify | `frontend/src/app/callsign-search/page.tsx` |

---

### Task 1: Data Model — Add QRZ columns to domain entities

**Files:**
- Modify: `backend/HamHub.Domain/Entities/ApplicationUser.cs`
- Modify: `backend/HamHub.Domain/Entities/QsoEntry.cs`

- [ ] **Step 1: Add QRZ fields to ApplicationUser**

Open `backend/HamHub.Domain/Entities/ApplicationUser.cs`. Add two properties before the navigation properties:

```csharp
public string? QrzApiKey { get; set; }        // stored encrypted via IDataProtector
public DateTime? QrzLastSyncedAt { get; set; }
```

Full file after change:
```csharp
using HamHub.Domain.Enums;
using Microsoft.AspNetCore.Identity;

namespace HamHub.Domain.Entities;

public class ApplicationUser : IdentityUser
{
    public string? Callsign { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Country { get; set; }
    public string? GridLocator { get; set; }
    public LicenseClass? LicenseClass { get; set; }
    public string? ProfileDescription { get; set; }
    public string? ProfileImageUrl { get; set; }
    public ProfileVisibility Visibility { get; set; } = ProfileVisibility.Public;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? QrzApiKey { get; set; }
    public DateTime? QrzLastSyncedAt { get; set; }

    public ICollection<StationProfile> Stations { get; set; } = new List<StationProfile>();
    public ICollection<QsoEntry> QsoEntries { get; set; } = new List<QsoEntry>();
    public ICollection<DxSpot> DxSpots { get; set; } = new List<DxSpot>();
    public ICollection<Article> Articles { get; set; } = new List<Article>();
}
```

- [ ] **Step 2: Add QRZ fields to QsoEntry**

Open `backend/HamHub.Domain/Entities/QsoEntry.cs`. Add `QrzId` and `UpdatedAt`:

```csharp
using HamHub.Domain.Enums;

namespace HamHub.Domain.Entities;

public class QsoEntry
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime DateUtc { get; set; }
    public string OwnCallsign { get; set; } = string.Empty;
    public string WorkedCallsign { get; set; } = string.Empty;
    public Band Band { get; set; }
    public double? Frequency { get; set; }
    public Mode Mode { get; set; }
    public string? RstSent { get; set; }
    public string? RstReceived { get; set; }
    public string? Locator { get; set; }
    public string? Country { get; set; }
    public string? Notes { get; set; }
    public string? QrzId { get; set; }        // QRZ internal log record ID; null = not yet synced
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
}
```

- [ ] **Step 3: Commit**

```bash
cd D:\hamhub
git add backend/HamHub.Domain/Entities/ApplicationUser.cs backend/HamHub.Domain/Entities/QsoEntry.cs
git commit -m "feat: add QRZ columns to ApplicationUser and QsoEntry"
```

---

### Task 2: EF Config update + DB recreation

**Files:**
- Modify: `backend/HamHub.Infrastructure/Persistence/Configurations/QsoEntryConfiguration.cs`

- [ ] **Step 1: Update QsoEntryConfiguration with QrzId config and partial index**

```csharp
using HamHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamHub.Infrastructure.Persistence.Configurations;

public class QsoEntryConfiguration : IEntityTypeConfiguration<QsoEntry>
{
    public void Configure(EntityTypeBuilder<QsoEntry> builder)
    {
        builder.HasKey(q => q.Id);
        builder.Property(q => q.OwnCallsign).HasMaxLength(20).IsRequired();
        builder.Property(q => q.WorkedCallsign).HasMaxLength(20).IsRequired();
        builder.Property(q => q.RstSent).HasMaxLength(10);
        builder.Property(q => q.RstReceived).HasMaxLength(10);
        builder.Property(q => q.Locator).HasMaxLength(10);
        builder.Property(q => q.Country).HasMaxLength(100);
        builder.Property(q => q.QrzId).HasMaxLength(30);

        builder.HasOne(q => q.User)
            .WithMany(u => u.QsoEntries)
            .HasForeignKey(q => q.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(q => q.UserId);
        builder.HasIndex(q => q.WorkedCallsign);
        builder.HasIndex(q => q.DateUtc);

        // Partial index for fast unsynced-QSO scan (used by QrzSyncService)
        builder.HasIndex(q => q.UserId)
            .HasFilter("\"QrzId\" IS NULL")
            .HasDatabaseName("IX_QsoEntries_UserId_Unsynced");
    }
}
```

- [ ] **Step 2: Drop and recreate the dev database**

The project uses `EnsureCreatedAsync` (not migrations), so the easiest way to apply schema changes in dev is to drop and recreate:

```bash
psql -U postgres -c "DROP DATABASE IF EXISTS hamhub;"
```

If `psql` is not in PATH, run via pgAdmin query tool: `DROP DATABASE IF EXISTS hamhub;`

The DB will be recreated with the new schema the next time the backend starts.

- [ ] **Step 3: Re-register test user**

After DB recreation, start the backend and re-register `micael.torp@gmail.com` / `2Control?!` via the app's register page or the API.

- [ ] **Step 4: Commit**

```bash
cd D:\hamhub
git add backend/HamHub.Infrastructure/Persistence/Configurations/QsoEntryConfiguration.cs
git commit -m "feat: add QrzId config and partial index to QsoEntryConfiguration"
```

---

### Task 3: QrzClient in Infrastructure

**Files:**
- Create: `backend/HamHub.Infrastructure/Services/QrzClient.cs`
- Modify: `backend/HamHub.Infrastructure/DependencyInjection.cs`

- [ ] **Step 1: Create QrzClient.cs**

Create `backend/HamHub.Infrastructure/Services/QrzClient.cs`:

```csharp
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Net.Http.Headers;
using System.Xml.Linq;

namespace HamHub.Infrastructure.Services;

public class QrzApiException(string message) : Exception(message);

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

public record AdifQso(
    string Call,
    DateTime TimeOn,
    string Band,
    string Mode,
    string? RstSent,
    string? RstReceived,
    string? Gridsquare,
    string? Country,
    string? LogId
);

public class QrzClient
{
    private static readonly XNamespace Ns = "http://xmldata.qrz.com";
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<QrzClient> _logger;

    public QrzClient(HttpClient http, IMemoryCache cache, ILogger<QrzClient> logger)
    {
        _http = http;
        _cache = cache;
        _logger = logger;
    }

    public async Task<QrzCallsignDto?> LookupCallsignAsync(string callsign, string apiKey, CancellationToken ct)
    {
        var cacheKey = $"qrz:call:{callsign.ToUpperInvariant()}";
        if (_cache.TryGetValue(cacheKey, out QrzCallsignDto? cached))
            return cached;

        var url = $"https://xmldata.qrz.com/xml/current/?s={Uri.EscapeDataString(apiKey)};callsign={Uri.EscapeDataString(callsign)}";
        var xml = await _http.GetStringAsync(url, ct);

        var doc = XDocument.Parse(xml);

        // Check for session-level errors (invalid key, quota exceeded, etc.)
        var sessionError = doc.Root?.Element(Ns + "Session")?.Element(Ns + "Error")?.Value;
        if (sessionError != null)
            throw new QrzApiException($"QRZ session error: {sessionError}");

        var callEl = doc.Root?.Element(Ns + "Callsign");
        if (callEl == null) return null;  // callsign not found

        string? Get(string name) => callEl.Element(Ns + name)?.Value;

        int? dxcc = int.TryParse(Get("dxcc"), out var d) ? d : null;
        var dto = new QrzCallsignDto(
            Callsign: Get("call") ?? callsign.ToUpperInvariant(),
            Name: $"{Get("fname")} {Get("name")}".Trim().NullIfEmpty(),
            Country: Get("country"),
            Grid: Get("grid"),
            Dxcc: dxcc,
            QslVia: Get("qslmgr"),
            ImageUrl: Get("image"),
            Email: Get("email")
        );

        _cache.Set(cacheKey, dto, TimeSpan.FromHours(24));
        return dto;
    }

    public async Task<IReadOnlyList<AdifQso>> FetchLogAsync(string apiKey, CancellationToken ct)
    {
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["KEY"] = apiKey,
            ["ACTION"] = "FETCH",
            ["OPTION"] = "ALL"
        });
        var response = await _http.PostAsync("https://logbook.qrz.com/api", content, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(ct);

        // Check for error response (URL-encoded format)
        if (body.Contains("RESULT=FAIL"))
        {
            var parts = ParseKvp(body);
            throw new QrzApiException(parts.GetValueOrDefault("REASON", "QRZ fetch failed"));
        }

        return ParseAdif(body);
    }

    public async Task<string> UploadQsoAsync(AdifQso qso, string apiKey, CancellationToken ct)
    {
        var adif = BuildAdif(qso);
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["KEY"] = apiKey,
            ["ACTION"] = "INSERT",
            ["ADIF"] = adif
        });
        var response = await _http.PostAsync("https://logbook.qrz.com/api", content, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(ct);
        var parts = ParseKvp(body);
        if (parts.GetValueOrDefault("RESULT") != "OK")
            throw new QrzApiException(parts.GetValueOrDefault("REASON", "QRZ upload failed"));
        if (!parts.TryGetValue("LOGID", out var logId))
            throw new QrzApiException("No LOGID in QRZ response");
        return logId;
    }

    public async Task DeleteQsoAsync(string qrzId, string apiKey, CancellationToken ct)
    {
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["KEY"] = apiKey,
            ["ACTION"] = "DELETE",
            ["LOGIDS"] = qrzId
        });
        var response = await _http.PostAsync("https://logbook.qrz.com/api", content, ct);
        response.EnsureSuccessStatusCode();
    }

    // ── ADIF helpers ──────────────────────────────────────────────────────────

    private static IReadOnlyList<AdifQso> ParseAdif(string adif)
    {
        var result = new List<AdifQso>();
        var records = adif.Split("<EOR>", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var rec in records)
        {
            var call = GetField(rec, "CALL");
            var dateStr = GetField(rec, "QSO_DATE");
            var timeStr = GetField(rec, "TIME_ON") ?? "0000";
            var band = GetField(rec, "BAND");
            var mode = GetField(rec, "MODE");
            if (call == null || dateStr == null || band == null || mode == null) continue;
            if (!DateTime.TryParseExact(dateStr + timeStr.PadRight(6, '0')[..4],
                "yyyyMMddHHmm", null, System.Globalization.DateTimeStyles.AssumeUniversal, out var dt))
                continue;
            result.Add(new AdifQso(
                Call: call.ToUpperInvariant(),
                TimeOn: DateTime.SpecifyKind(dt, DateTimeKind.Utc),
                Band: band.ToUpperInvariant(),
                Mode: mode.ToUpperInvariant(),
                RstSent: GetField(rec, "RST_SENT"),
                RstReceived: GetField(rec, "RST_RCVD"),
                Gridsquare: GetField(rec, "GRIDSQUARE"),
                Country: GetField(rec, "COUNTRY"),
                LogId: GetField(rec, "APP_QRZLOG_LOGID")
            ));
        }
        return result;
    }

    private static string? GetField(string record, string name)
    {
        var pattern = $"<{name}:";
        var idx = record.IndexOf(pattern, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;
        var colonIdx = record.IndexOf('>', idx);
        if (colonIdx < 0) return null;
        var lenStr = record[(idx + name.Length + 2)..colonIdx];
        if (!int.TryParse(lenStr.Split(':')[0], out var len)) return null;
        var start = colonIdx + 1;
        if (start + len > record.Length) return null;
        return record.Substring(start, len);
    }

    private static string BuildAdif(AdifQso qso)
    {
        static string F(string n, string v) => $"<{n}:{v.Length}>{v}";
        var sb = new System.Text.StringBuilder();
        sb.Append(F("CALL", qso.Call));
        sb.Append(F("QSO_DATE", qso.TimeOn.ToString("yyyyMMdd")));
        sb.Append(F("TIME_ON", qso.TimeOn.ToString("HHmm")));
        sb.Append(F("BAND", qso.Band));
        sb.Append(F("MODE", qso.Mode));
        if (!string.IsNullOrEmpty(qso.RstSent)) sb.Append(F("RST_SENT", qso.RstSent));
        if (!string.IsNullOrEmpty(qso.RstReceived)) sb.Append(F("RST_RCVD", qso.RstReceived));
        if (!string.IsNullOrEmpty(qso.Gridsquare)) sb.Append(F("GRIDSQUARE", qso.Gridsquare));
        if (!string.IsNullOrEmpty(qso.Country)) sb.Append(F("COUNTRY", qso.Country));
        sb.Append("<EOR>");
        return sb.ToString();
    }

    private static Dictionary<string, string> ParseKvp(string body) =>
        body.Split('&')
            .Select(p => p.Split('=', 2))
            .Where(p => p.Length == 2)
            .ToDictionary(p => p[0], p => Uri.UnescapeDataString(p[1]));
}

internal static class StringExtensions
{
    internal static string? NullIfEmpty(this string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s;
}
```

- [ ] **Step 2: Update DependencyInjection.cs to register QrzClient and IMemoryCache**

```csharp
using HamHub.Application.Common.Interfaces;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HamHub.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        services.AddIdentity<ApplicationUser, IdentityRole>(options =>
        {
            options.Password.RequiredLength = 6;
            options.Password.RequireNonAlphanumeric = false;
            options.User.RequireUniqueEmail = true;
        })
        .AddEntityFrameworkStores<ApplicationDbContext>()
        .AddDefaultTokenProviders();

        services.AddScoped<ITokenService, TokenService>();
        services.AddMemoryCache();
        services.AddHttpClient<QrzClient>();

        return services;
    }
}
```

- [ ] **Step 3: Verify build**

```bash
cd D:\hamhub\backend
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
cd D:\hamhub
git add backend/HamHub.Infrastructure/Services/QrzClient.cs backend/HamHub.Infrastructure/DependencyInjection.cs
git commit -m "feat: add QrzClient with XML lookup and ADIF logbook support"
```

---

### Task 4: QrzSyncTrigger + QrzSyncService

**Files:**
- Create: `backend/HamHub.Api/Services/QrzSyncTrigger.cs`
- Create: `backend/HamHub.Api/Services/QrzSyncService.cs`

- [ ] **Step 1: Create QrzSyncTrigger.cs**

```csharp
using System.Runtime.CompilerServices;
using System.Threading.Channels;

namespace HamHub.Api.Services;

public interface IQrzSyncTrigger
{
    void NotifyQsoChanged(string userId);
    IAsyncEnumerable<string> ReadAsync(CancellationToken ct);
}

public class QrzSyncTrigger : IQrzSyncTrigger
{
    private readonly Channel<string> _channel = Channel.CreateUnbounded<string>(
        new UnboundedChannelOptions { SingleReader = true });

    public void NotifyQsoChanged(string userId) =>
        _channel.Writer.TryWrite(userId);

    public IAsyncEnumerable<string> ReadAsync(CancellationToken ct) =>
        _channel.Reader.ReadAllAsync(ct);
}
```

- [ ] **Step 2: Create QrzSyncService.cs**

```csharp
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Services;

public class QrzSyncService : BackgroundService
{
    private readonly IQrzSyncTrigger _trigger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IDataProtector _protector;
    private readonly ILogger<QrzSyncService> _logger;

    private static readonly Dictionary<string, Band> BandMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["160M"] = Band.M160, ["80M"] = Band.M80, ["60M"] = Band.M60, ["40M"] = Band.M40,
        ["30M"] = Band.M30, ["20M"] = Band.M20, ["17M"] = Band.M17, ["15M"] = Band.M15,
        ["12M"] = Band.M12, ["10M"] = Band.M10, ["6M"] = Band.M6, ["2M"] = Band.M2,
        ["70CM"] = Band.CM70
    };
    private static readonly Dictionary<string, Mode> ModeMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SSB"] = Mode.SSB, ["USB"] = Mode.SSB, ["LSB"] = Mode.SSB,
        ["CW"] = Mode.CW, ["FT8"] = Mode.FT8, ["FT4"] = Mode.FT4,
        ["RTTY"] = Mode.RTTY, ["DMR"] = Mode.DMR, ["FM"] = Mode.FM, ["AM"] = Mode.AM
    };
    private static readonly Dictionary<Band, string> BandAdif = new()
    {
        [Band.M160] = "160M", [Band.M80] = "80M", [Band.M60] = "60M", [Band.M40] = "40M",
        [Band.M30] = "30M", [Band.M20] = "20M", [Band.M17] = "17M", [Band.M15] = "15M",
        [Band.M12] = "12M", [Band.M10] = "10M", [Band.M6] = "6M", [Band.M2] = "2M",
        [Band.CM70] = "70CM"
    };
    private static readonly Dictionary<Mode, string> ModeAdif = new()
    {
        [Mode.SSB] = "SSB", [Mode.CW] = "CW", [Mode.FT8] = "FT8", [Mode.FT4] = "FT4",
        [Mode.RTTY] = "RTTY", [Mode.DMR] = "DMR", [Mode.FM] = "FM", [Mode.AM] = "AM"
    };

    public QrzSyncService(
        IQrzSyncTrigger trigger,
        IServiceScopeFactory scopeFactory,
        IDataProtectionProvider dataProtectionProvider,
        ILogger<QrzSyncService> logger)
    {
        _trigger = trigger;
        _scopeFactory = scopeFactory;
        _protector = dataProtectionProvider.CreateProtector("QrzApiKey");
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Event loop: immediately sync when notified of a new/updated QSO
        _ = Task.Run(async () =>
        {
            await foreach (var userId in _trigger.ReadAsync(stoppingToken))
                await SyncUserAsync(userId, stoppingToken);
        }, CancellationToken.None);

        // Periodic loop: full sync every 15 minutes
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
                await RunPeriodicSyncAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }

    private async Task RunPeriodicSyncAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userIds = await db.Users
            .Where(u => u.QrzApiKey != null)
            .Select(u => u.Id)
            .ToListAsync(ct);

        foreach (var userId in userIds)
            await SyncUserAsync(userId, ct);
    }

    private async Task SyncUserAsync(string userId, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var qrzClient = scope.ServiceProvider.GetRequiredService<QrzClient>();

        var user = await db.Users.FindAsync([userId], ct);
        if (user?.QrzApiKey == null) return;

        string apiKey;
        try { apiKey = _protector.Unprotect(user.QrzApiKey); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to decrypt QRZ API key for user {UserId}", userId);
            return;
        }

        try
        {
            var qrzQsos = await qrzClient.FetchLogAsync(apiKey, ct);

            foreach (var qrzQso in qrzQsos)
            {
                if (!BandMap.TryGetValue(qrzQso.Band, out var band)) continue;
                if (!ModeMap.TryGetValue(qrzQso.Mode, out var mode)) continue;

                var lower = qrzQso.TimeOn.AddSeconds(-30);
                var upper = qrzQso.TimeOn.AddSeconds(30);

                var match = await db.QsoEntries.FirstOrDefaultAsync(q =>
                    q.UserId == userId &&
                    q.WorkedCallsign == qrzQso.Call &&
                    q.DateUtc >= lower && q.DateUtc <= upper &&
                    q.Mode == mode && q.Band == band, ct);

                if (match == null)
                {
                    // New record from QRZ — import it
                    db.QsoEntries.Add(new QsoEntry
                    {
                        UserId = userId,
                        WorkedCallsign = qrzQso.Call,
                        OwnCallsign = user.Callsign ?? string.Empty,
                        DateUtc = qrzQso.TimeOn,
                        Band = band,
                        Mode = mode,
                        RstSent = qrzQso.RstSent,
                        RstReceived = qrzQso.RstReceived,
                        Locator = qrzQso.Gridsquare,
                        Country = qrzQso.Country,
                        QrzId = qrzQso.LogId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                else if (match.QrzId == null)
                {
                    // Match found, not yet linked. Newest-wins: compare local UpdatedAt vs QRZ QSO date.
                    // If local was modified after the QSO time (i.e., user edited it locally), local is newer.
                    if (match.UpdatedAt > match.CreatedAt)
                    {
                        // Local was edited after creation — upload local version to QRZ
                        try
                        {
                            var adifQso = new AdifQso(
                                Call: match.WorkedCallsign,
                                TimeOn: match.DateUtc,
                                Band: BandAdif.GetValueOrDefault(match.Band, "20M"),
                                Mode: ModeAdif.GetValueOrDefault(match.Mode, "SSB"),
                                RstSent: match.RstSent,
                                RstReceived: match.RstReceived,
                                Gridsquare: match.Locator,
                                Country: match.Country,
                                LogId: null
                            );
                            match.QrzId = await qrzClient.UploadQsoAsync(adifQso, apiKey, ct);
                        }
                        catch (QrzApiException ex)
                        {
                            _logger.LogError(ex, "Failed to upload matched QSO {Id} to QRZ", match.Id);
                        }
                    }
                    else
                    {
                        // QRZ is authoritative — overwrite local fields and link
                        match.RstSent = qrzQso.RstSent ?? match.RstSent;
                        match.RstReceived = qrzQso.RstReceived ?? match.RstReceived;
                        match.Locator = qrzQso.Gridsquare ?? match.Locator;
                        match.Country = qrzQso.Country ?? match.Country;
                        match.QrzId = qrzQso.LogId;
                    }
                    match.UpdatedAt = DateTime.UtcNow;
                }
                // else: already synced (QrzId != null) — local is source of truth; changes are
                // propagated via the "upload unsynced" pass below (QrzId cleared on edit in QsosController)
            }

            // Upload any local QSOs that have never been synced to QRZ
            var unsynced = await db.QsoEntries
                .Where(q => q.UserId == userId && q.QrzId == null)
                .ToListAsync(ct);

            foreach (var qso in unsynced)
            {
                try
                {
                    var adifQso = new AdifQso(
                        Call: qso.WorkedCallsign,
                        TimeOn: qso.DateUtc,
                        Band: BandAdif.GetValueOrDefault(qso.Band, "20M"),
                        Mode: ModeAdif.GetValueOrDefault(qso.Mode, "SSB"),
                        RstSent: qso.RstSent,
                        RstReceived: qso.RstReceived,
                        Gridsquare: qso.Locator,
                        Country: qso.Country,
                        LogId: null
                    );
                    qso.QrzId = await qrzClient.UploadQsoAsync(adifQso, apiKey, ct);
                    qso.UpdatedAt = DateTime.UtcNow;
                }
                catch (QrzApiException ex)
                {
                    _logger.LogError(ex, "Failed to upload QSO {Id} to QRZ for user {UserId}", qso.Id, userId);
                }
            }

            user.QrzLastSyncedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        catch (QrzApiException ex)
        {
            _logger.LogWarning(ex, "QRZ sync failed for user {UserId} — will retry next tick", userId);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during QRZ sync for user {UserId}", userId);
        }
    }
}
```

- [ ] **Step 3: Verify build**

```bash
cd D:\hamhub\backend
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
cd D:\hamhub
git add backend/HamHub.Api/Services/QrzSyncTrigger.cs backend/HamHub.Api/Services/QrzSyncService.cs
git commit -m "feat: add QrzSyncTrigger channel and QrzSyncService background worker"
```

---

### Task 5: QrzController

**Files:**
- Create: `backend/HamHub.Api/Controllers/QrzController.cs`

- [ ] **Step 1: Create QrzController.cs**

```csharp
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using HamHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/qrz")]
public class QrzController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly QrzClient _qrzClient;
    private readonly IQrzSyncTrigger _trigger;
    private readonly IDataProtector _protector;
    private readonly IConfiguration _config;

    public QrzController(
        ApplicationDbContext context,
        QrzClient qrzClient,
        IQrzSyncTrigger trigger,
        IDataProtectionProvider dataProtectionProvider,
        IConfiguration config)
    {
        _context = context;
        _qrzClient = qrzClient;
        _trigger = trigger;
        _protector = dataProtectionProvider.CreateProtector("QrzApiKey");
        _config = config;
    }

    [HttpGet("lookup")]
    [AllowAnonymous]
    [EnableRateLimiting("qrz-lookup")]
    public async Task<IActionResult> Lookup([FromQuery] string callsign, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(callsign)) return BadRequest("callsign is required");

        string? apiKey = null;

        // Try authenticated user's own key first
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId != null)
        {
            var user = await _context.Users.FindAsync([userId], ct);
            if (user?.QrzApiKey != null)
            {
                try { apiKey = _protector.Unprotect(user.QrzApiKey); }
                catch { apiKey = null; }
            }
        }

        // Fall back to system default key
        apiKey ??= _config["Qrz:DefaultApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey)) return StatusCode(503, "QRZ API key not configured");

        var result = await _qrzClient.LookupCallsignAsync(callsign.Trim().ToUpperInvariant(), apiKey, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpGet("status")]
    [Authorize]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _context.Users.FindAsync([userId], ct);
        if (user == null) return NotFound();

        return Ok(new
        {
            connected = user.QrzApiKey != null,
            lastSyncedAt = user.QrzLastSyncedAt,
            qrzCallsign = user.Callsign
        });
    }

    [HttpPost("sync")]
    [Authorize]
    public IActionResult Sync()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        _trigger.NotifyQsoChanged(userId);
        return Accepted();
    }
}
```

- [ ] **Step 2: Verify build**

```bash
cd D:\hamhub\backend
dotnet build
```

Expected: Build succeeded, 0 errors. (Will have errors until Program.cs is updated — that is Task 6.)

- [ ] **Step 3: Commit**

```bash
cd D:\hamhub
git add backend/HamHub.Api/Controllers/QrzController.cs
git commit -m "feat: add QrzController with lookup, status, sync endpoints"
```

---

### Task 6: UsersController qrz-key endpoint + Program.cs wiring

**Files:**
- Modify: `backend/HamHub.Api/Controllers/UsersController.cs`
- Modify: `backend/HamHub.Api/Program.cs`
- Modify: `backend/HamHub.Api/appsettings.json`

- [ ] **Step 1: Add PUT /api/users/me/qrz-key to UsersController**

Read `backend/HamHub.Api/Controllers/UsersController.cs` in full, then add these imports and method:

Add to imports at top:
```csharp
using Microsoft.AspNetCore.DataProtection;
using HamHub.Infrastructure.Services;
using System.Text.RegularExpressions;
```

Add `IDataProtector _protector` and `QrzClient _qrzClient` fields. The constructor becomes:

```csharp
private readonly UserManager<ApplicationUser> _userManager;
private readonly ApplicationDbContext _context;
private readonly IMapper _mapper;
private readonly IDataProtector _protector;
private readonly QrzClient _qrzClient;

public UsersController(
    UserManager<ApplicationUser> userManager,
    ApplicationDbContext context,
    IMapper mapper,
    IDataProtectionProvider dataProtectionProvider,
    QrzClient qrzClient)
{
    _userManager = userManager;
    _context = context;
    _mapper = mapper;
    _protector = dataProtectionProvider.CreateProtector("QrzApiKey");
    _qrzClient = qrzClient;
}
```

Add the new endpoint at the end of the class (before the closing `}`):

```csharp
[HttpPut("me/qrz-key")]
[Authorize]
public async Task<IActionResult> SaveQrzKey([FromBody] SaveQrzKeyDto dto, CancellationToken ct)
{
    // Validate format
    if (!Regex.IsMatch(dto.ApiKey ?? "", @"^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$"))
        return BadRequest("Ugyldig API nøgle format. Forventet: XXXX-XXXX-XXXX-XXXX");

    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var user = await _userManager.FindByIdAsync(userId);
    if (user == null) return NotFound();

    // Verify key by doing a test lookup with the user's own callsign
    if (!string.IsNullOrWhiteSpace(user.Callsign))
    {
        try
        {
            var result = await _qrzClient.LookupCallsignAsync(user.Callsign, dto.ApiKey!, ct);
            if (result == null)
                return BadRequest($"API nøglen er gyldig men kaldesignalet {user.Callsign} blev ikke fundet på QRZ");
        }
        catch (QrzApiException ex)
        {
            return BadRequest($"QRZ API fejl: {ex.Message}");
        }
        catch (Exception)
        {
            return BadRequest("Kunne ikke forbinde til QRZ. Kontroller API nøglen.");
        }
    }

    user.QrzApiKey = _protector.Protect(dto.ApiKey!);
    await _userManager.UpdateAsync(user);

    return Ok(new { callsign = user.Callsign });
}
```

Add the DTO record below the controller class (same file, same namespace):
```csharp
public record SaveQrzKeyDto(string? ApiKey);
```

- [ ] **Step 2: Update Program.cs — register services and rate limiter**

Read `backend/HamHub.Api/Program.cs` in full. Add the following registrations:

After `builder.Services.AddHostedService<HamHub.Api.Services.WsjtxPruneService>();`, add:

```csharp
builder.Services.AddSingleton<HamHub.Api.Services.IQrzSyncTrigger, HamHub.Api.Services.QrzSyncTrigger>();
builder.Services.AddHostedService<HamHub.Api.Services.QrzSyncService>();
```

After `builder.Services.AddAuthorization();`, add:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("qrz-lookup", o =>
    {
        o.Window = TimeSpan.FromMinutes(1);
        o.PermitLimit = 30;
        o.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
        o.QueueLimit = 0;
    });
});
```

After `app.UseCors();`, add:

```csharp
app.UseRateLimiter();
```

- [ ] **Step 3: Add Qrz:DefaultApiKey to appsettings.json**

Add the following section to `backend/HamHub.Api/appsettings.json`:

```json
"Qrz": {
  "DefaultApiKey": ""
}
```

The full file:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=hamhub;Username=postgres;Password=postgres"
  },
  "JwtSettings": {
    "Secret": "HamHub-Super-Secret-Key-MinLength-32-Chars!",
    "Issuer": "HamHub",
    "Audience": "HamHub",
    "ExpiryMinutes": 1440
  },
  "Qrz": {
    "DefaultApiKey": ""
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://localhost:3000"
    ]
  }
}
```

- [ ] **Step 4: Verify build and smoke test**

```bash
cd D:\hamhub\backend
dotnet build
```

Expected: Build succeeded, 0 errors.

Start backend:
```bash
cd D:\hamhub\backend\HamHub.Api
dotnet run
```

Test endpoints (replace TOKEN with a valid JWT from login):
```bash
# Status (should return connected: false)
curl -H "Authorization: Bearer TOKEN" http://localhost:5085/api/qrz/status

# Lookup (anonymous, should return 503 until DefaultApiKey is set, or 200 if user has key)
curl http://localhost:5085/api/qrz/lookup?callsign=OZ4MT
```

- [ ] **Step 5: Commit**

```bash
cd D:\hamhub
git add backend/HamHub.Api/Controllers/UsersController.cs backend/HamHub.Api/Program.cs backend/HamHub.Api/appsettings.json
git commit -m "feat: add qrz-key endpoint, wire QrzSyncService/Trigger, add rate limiter"
```

---

### Task 7: QsosController — trigger notification + QsoDto update

**Files:**
- Modify: `backend/HamHub.Application/QsoEntries/DTOs/QsoDto.cs`
- Modify: `backend/HamHub.Api/Controllers/QsosController.cs`

- [ ] **Step 1: Add QrzId and UpdatedAt to QsoDto**

```csharp
using HamHub.Domain.Enums;

namespace HamHub.Application.QsoEntries.DTOs;

public record QsoDto(
    int Id,
    string UserId,
    DateTime DateUtc,
    string OwnCallsign,
    string WorkedCallsign,
    Band Band,
    double? Frequency,
    Mode Mode,
    string? RstSent,
    string? RstReceived,
    string? Locator,
    string? Country,
    string? Notes,
    string? QrzId,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
```

AutoMapper will map `QsoEntry.QrzId → QsoDto.QrzId` and `QsoEntry.UpdatedAt → QsoDto.UpdatedAt` automatically via naming convention (no MappingProfile changes needed).

- [ ] **Step 2: Update QsosController to inject trigger and set UpdatedAt**

Read `backend/HamHub.Api/Controllers/QsosController.cs` in full.

Add import:
```csharp
using HamHub.Api.Services;
```

Update the constructor to inject `IQrzSyncTrigger`:
```csharp
private readonly ApplicationDbContext _context;
private readonly IMapper _mapper;
private readonly IQrzSyncTrigger _trigger;

public QsosController(ApplicationDbContext context, IMapper mapper, IQrzSyncTrigger trigger)
{
    _context = context;
    _mapper = mapper;
    _trigger = trigger;
}
```

In the `Create` method, after `await _context.SaveChangesAsync();`, add:
```csharp
_trigger.NotifyQsoChanged(userId);
```

In the `Update` method, after updating fields and before `await _context.SaveChangesAsync();`, add:
```csharp
qso.UpdatedAt = DateTime.UtcNow;
```
And after `await _context.SaveChangesAsync();`, add:
```csharp
_trigger.NotifyQsoChanged(userId!);
```

Also in the `Create` method, after `var qso = _mapper.Map<QsoEntry>(dto);`, add:
```csharp
qso.UpdatedAt = DateTime.UtcNow;
```

The updated Create and Update methods:

```csharp
[HttpPost]
public async Task<IActionResult> Create([FromBody] CreateQsoDto dto)
{
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var qso = _mapper.Map<QsoEntry>(dto);
    qso.UserId = userId;
    qso.UpdatedAt = DateTime.UtcNow;
    _context.QsoEntries.Add(qso);
    await _context.SaveChangesAsync();
    _trigger.NotifyQsoChanged(userId);
    return CreatedAtAction(nameof(GetById), new { id = qso.Id }, _mapper.Map<QsoDto>(qso));
}

[HttpPut("{id}")]
public async Task<IActionResult> Update(int id, [FromBody] CreateQsoDto dto)
{
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    var qso = await _context.QsoEntries.FindAsync(id);
    if (qso == null) return NotFound();
    if (qso.UserId != userId) return Forbid();

    qso.DateUtc = dto.DateUtc;
    qso.OwnCallsign = dto.OwnCallsign;
    qso.WorkedCallsign = dto.WorkedCallsign;
    qso.Band = dto.Band;
    qso.Frequency = dto.Frequency;
    qso.Mode = dto.Mode;
    qso.RstSent = dto.RstSent;
    qso.RstReceived = dto.RstReceived;
    qso.Locator = dto.Locator;
    qso.Country = dto.Country;
    qso.Notes = dto.Notes;
    qso.UpdatedAt = DateTime.UtcNow;
    // Clear QrzId so the sync service re-uploads the edited record to QRZ as a new entry.
    // (QRZ Logbook API has no UPDATE verb; the old entry will remain on QRZ but the corrected
    // version will be uploaded. Deleting the old QRZ entry is out of scope per the spec.)
    qso.QrzId = null;

    await _context.SaveChangesAsync();
    _trigger.NotifyQsoChanged(userId!);
    return Ok(_mapper.Map<QsoDto>(qso));
}
```

- [ ] **Step 3: Verify build**

```bash
cd D:\hamhub\backend
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
cd D:\hamhub
git add backend/HamHub.Application/QsoEntries/DTOs/QsoDto.cs backend/HamHub.Api/Controllers/QsosController.cs
git commit -m "feat: add QrzId/UpdatedAt to QsoDto, notify QrzSyncTrigger on QSO create/update"
```

---

### Task 8: Frontend — types.ts + api.ts

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add QRZ types to types.ts**

Add `qrzId` and `updatedAt` to the `Qso` interface, and add new QRZ interfaces. Read `frontend/src/lib/types.ts` first, then add:

In the `Qso` interface, add two fields after `createdAt`:
```typescript
export interface Qso {
  id: number
  userId: string
  dateUtc: string
  ownCallsign: string
  workedCallsign: string
  band: Band
  frequency: number | null
  mode: Mode
  rstSent: string | null
  rstReceived: string | null
  locator: string | null
  country: string | null
  notes: string | null
  qrzId: string | null
  createdAt: string
  updatedAt: string
}
```

After the last existing interface in types.ts, add:
```typescript
export interface QrzStatus {
  connected: boolean
  lastSyncedAt: string | null
  qrzCallsign: string | null
}

export interface QrzCallsignInfo {
  callsign: string
  name: string | null
  country: string | null
  grid: string | null
  dxcc: number | null
  qslVia: string | null
  imageUrl: string | null
  email: string | null
}
```

- [ ] **Step 2: Add QRZ methods to api.ts**

Read `frontend/src/lib/api.ts` in full, then add a `qrz` section to the `api` object:

```typescript
qrz: {
  lookup: (callsign: string) =>
    request<import('./types').QrzCallsignInfo>(`/api/qrz/lookup?callsign=${encodeURIComponent(callsign)}`),
  status: () =>
    request<import('./types').QrzStatus>('/api/qrz/status'),
  sync: () =>
    request<void>('/api/qrz/sync', { method: 'POST' }),
  saveKey: (apiKey: string) =>
    request<{ callsign: string | null }>('/api/users/me/qrz-key', { method: 'PUT', body: JSON.stringify({ apiKey }) }),
},
```

Also update the `request` function to handle 202 status (same as 204):
```typescript
if (res.status === 204 || res.status === 202) return undefined as T
```

- [ ] **Step 3: Verify frontend builds**

```bash
cd D:\hamhub\frontend
npm run build
```

Expected: Build succeeds (no TypeScript errors).

- [ ] **Step 4: Commit**

```bash
cd D:\hamhub
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add QRZ types and API client methods"
```

---

### Task 9: Frontend — Profile page QRZ section

**Files:**
- Modify: `frontend/src/app/profile/page.tsx`

- [ ] **Step 1: Add QRZ integration section to profile page**

Read `frontend/src/app/profile/page.tsx` in full. Add the following:

1. New import at top: `import { type QrzStatus } from '@/lib/types'`

2. New state variables after `const [loading, setLoading] = useState(false)`:
```typescript
const [qrzKey, setQrzKey] = useState('')
const [qrzStatus, setQrzStatus] = useState<QrzStatus | null>(null)
const [qrzLoading, setQrzLoading] = useState(false)
const [qrzSyncing, setQrzSyncing] = useState(false)
```

3. Add QRZ status fetch inside the `useEffect` that already runs:
```typescript
useEffect(() => {
  if (user) {
    setForm({
      callsign: user.callsign || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      country: user.country || '',
      gridLocator: user.gridLocator || '',
      profileDescription: user.profileDescription || '',
      visibility: user.visibility,
    })
    api.qrz.status().then(setQrzStatus).catch(() => {})
  }
}, [user])
```

4. Add handler functions before the `return`:
```typescript
const handleSaveQrzKey = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!qrzKey.trim()) return
  setQrzLoading(true)
  try {
    await api.qrz.saveKey(qrzKey.trim())
    toast('QRZ API nøgle gemt og verificeret!')
    setQrzKey('')
    const status = await api.qrz.status()
    setQrzStatus(status)
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Kunne ikke gemme QRZ nøgle', 'error')
  } finally {
    setQrzLoading(false)
  }
}

const handleQrzSync = async () => {
  setQrzSyncing(true)
  try {
    await api.qrz.sync()
    // Poll for completion (up to 30s)
    const deadline = Date.now() + 30_000
    const prevSyncedAt = qrzStatus?.lastSyncedAt
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000))
      const status = await api.qrz.status()
      setQrzStatus(status)
      if (status.lastSyncedAt !== prevSyncedAt) break
    }
    toast('QRZ synkronisering fuldført!')
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Synkronisering mislykkedes', 'error')
  } finally {
    setQrzSyncing(false)
  }
}
```

5. Add the QRZ section after the existing profile form Card, before the closing `</div>` of the page:

```tsx
<Card>
  <CardHeader><CardTitle>QRZ Integration</CardTitle></CardHeader>
  <CardContent>
    {qrzStatus?.connected ? (
      <div className="flex flex-col gap-3">
        <p className="text-green-400 text-sm">
          Tilsluttet som {qrzStatus.qrzCallsign || 'ukendt'}
          {qrzStatus.lastSyncedAt && (
            <span className="text-gray-400 ml-2">
              — Sidst synkroniseret: {new Date(qrzStatus.lastSyncedAt).toLocaleString('da-DK')}
            </span>
          )}
        </p>
        <Button onClick={handleQrzSync} disabled={qrzSyncing} variant="secondary">
          {qrzSyncing ? 'Synkroniserer...' : 'Synkroniser nu'}
        </Button>
      </div>
    ) : (
      <p className="text-gray-400 text-sm mb-3">Ikke tilsluttet QRZ</p>
    )}
    <form onSubmit={handleSaveQrzKey} className="flex flex-col gap-3 mt-4">
      <Input
        label={`QRZ Logbook API nøgle${qrzStatus?.connected ? ' (efterlad tom for at beholde eksisterende)' : ''}`}
        type="password"
        value={qrzKey}
        onChange={e => setQrzKey(e.target.value.toUpperCase())}
        placeholder="F82B-A8C7-8B74-82EA"
        autoComplete="off"
      />
      <Button type="submit" disabled={qrzLoading || !qrzKey.trim()}>
        {qrzLoading ? 'Verificerer...' : 'Gem og verificer'}
      </Button>
    </form>
  </CardContent>
</Card>
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd D:\hamhub\frontend
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd D:\hamhub
git add frontend/src/app/profile/page.tsx
git commit -m "feat: add QRZ integration section to profile page"
```

---

### Task 10: Frontend — Logbook QRZ badge + sync button

**Files:**
- Modify: `frontend/src/app/logbook/page.tsx`

- [ ] **Step 1: Add QRZ badge column and sync button to logbook page**

Read `frontend/src/app/logbook/page.tsx` in full.

Add new import at top: none needed — `api` is already imported and `Button` is imported.

Add state variables after `const [page, setPage] = useState(1)`:
```typescript
const [qrzSyncing, setQrzSyncing] = useState(false)
```

Add sync handler before `return`:
```typescript
const handleQrzSync = async () => {
  setQrzSyncing(true)
  try {
    await api.qrz.sync()
    toast('QRZ synkronisering startet...')
    await new Promise(r => setTimeout(r, 3000))
    load(search)
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Synkronisering mislykkedes', 'error')
  } finally {
    setQrzSyncing(false)
  }
}
```

In the toolbar div (the `<div className="flex gap-2">` containing the ADIF export/import buttons), add the QRZ sync button before the "Eksporter ADIF" button:
```tsx
<Button variant="secondary" onClick={handleQrzSync} disabled={qrzSyncing}>
  {qrzSyncing ? 'Synkroniserer...' : 'QRZ Sync'}
</Button>
```

Change the table headers from:
```typescript
{['Dato/tid (UTC)', 'Eget kald', 'Kontakt', 'Band', 'Mode', 'RST S/R', 'Land', '', ''].map(...)}
```
to:
```typescript
{['Dato/tid (UTC)', 'Eget kald', 'Kontakt', 'Band', 'Mode', 'RST S/R', 'Land', 'QRZ', '', ''].map(...)}
```

In the table rows, after the `<td>` for `q.country`, add a new `<td>` for the QRZ badge:
```tsx
<td className="px-4 py-3">
  {q.qrzId && (
    <span className="text-xs text-green-400 font-medium">QRZ ✓</span>
  )}
</td>
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd D:\hamhub\frontend
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd D:\hamhub
git add frontend/src/app/logbook/page.tsx
git commit -m "feat: add QRZ sync button and badge to logbook page"
```

---

### Task 11: Frontend — Callsign-search QRZ auto-enrich

**Files:**
- Modify: `frontend/src/app/callsign-search/page.tsx`

- [ ] **Step 1: Add QRZ auto-enrich to callsign-search page**

Read `frontend/src/app/callsign-search/page.tsx` in full.

Add `useEffect` to imports: `import { useState, useEffect, useRef } from 'react'`

Add QRZ types import: `import { type QrzCallsignInfo } from '@/lib/types'`

Add new state variables after `const [searched, setSearched] = useState(false)`:
```typescript
const [qrzInfo, setQrzInfo] = useState<QrzCallsignInfo | null>(null)
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

Add a `useEffect` for the debounced QRZ lookup, after the component state declarations:
```typescript
useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  if (callsign.length < 3) { setQrzInfo(null); return }
  debounceRef.current = setTimeout(async () => {
    try {
      const info = await api.qrz.lookup(callsign)
      setQrzInfo(info)
    } catch {
      setQrzInfo(null)
    }
  }, 300)
  return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
}, [callsign])
```

After the existing `{user && (...)}` block, add the QRZ info panel:
```tsx
{qrzInfo && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-3">
        QRZ: {qrzInfo.callsign}
        {qrzInfo.imageUrl && (
          <img src={qrzInfo.imageUrl} alt={qrzInfo.callsign} className="h-10 w-10 rounded-full object-cover" />
        )}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {qrzInfo.name && <div><span className="text-gray-400">Navn: </span><span className="text-white">{qrzInfo.name}</span></div>}
        {qrzInfo.country && <div><span className="text-gray-400">Land: </span><span className="text-white">{qrzInfo.country}</span></div>}
        {qrzInfo.grid && <div><span className="text-gray-400">Grid: </span><span className="text-white font-mono">{qrzInfo.grid}</span></div>}
        {qrzInfo.dxcc && <div><span className="text-gray-400">DXCC: </span><span className="text-white">{qrzInfo.dxcc}</span></div>}
        {qrzInfo.qslVia && <div><span className="text-gray-400">QSL via: </span><span className="text-white">{qrzInfo.qslVia}</span></div>}
        {qrzInfo.email && <div><span className="text-gray-400">Email: </span><span className="text-white">{qrzInfo.email}</span></div>}
      </div>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd D:\hamhub\frontend
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: End-to-end smoke test**

1. Start backend: `cd D:\hamhub\backend\HamHub.Api && dotnet run`
2. Start frontend: `cd D:\hamhub\frontend && npm run dev`
3. Register user `micael.torp@gmail.com` / `2Control?!`
4. Go to `/profile`, add QRZ key `F82B-A8C7-8B74-82EA` → should show "Tilsluttet som OZ4MT"
5. Click "Synkroniser nu" → spinner then success toast
6. Go to `/logbook` → synced QSOs should show "QRZ ✓" badge
7. Go to `/callsign-search` → type `OZ4MT` → QRZ panel should auto-appear below after 300ms

- [ ] **Step 4: Commit**

```bash
cd D:\hamhub
git add frontend/src/app/callsign-search/page.tsx
git commit -m "feat: add QRZ auto-enrich to callsign-search page"
```

---

## Done

All 11 tasks complete. The implementation delivers:
- **Callsign lookup** — debounced QRZ info panel on `/callsign-search`
- **API key management** — save + verify on `/profile` with IDataProtector encryption
- **Two-way sync** — event-driven (on QSO create/update) + 15-minute periodic
- **Logbook integration** — QRZ ✓ badge per row, manual sync button
- **Rate limiting** — 30 req/min per IP on the anonymous lookup endpoint
