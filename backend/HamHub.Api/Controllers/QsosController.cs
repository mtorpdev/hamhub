using AutoMapper;
using HamHub.Api.Services;
using HamHub.Application.QsoEntries.DTOs;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/qsos")]
[Authorize]
public class QsosController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IQrzSyncTrigger _trigger;
    private readonly EqslClient _eqslClient;
    private readonly IDataProtector _eqslProtector;
    private readonly IDataProtector _qrzProtector;
    private readonly IDataProtector _lotwProtector;
    private readonly OpenMeteoWeatherService _weatherService;
    private readonly NoaaSwpcPropagationService _propagationService;
    private readonly QsoAwardEnrichmentService _awardEnrichment;

    public QsosController(
        ApplicationDbContext context,
        IMapper mapper,
        IQrzSyncTrigger trigger,
        EqslClient eqslClient,
        OpenMeteoWeatherService weatherService,
        NoaaSwpcPropagationService propagationService,
        IDataProtectionProvider dataProtectionProvider,
        QsoAwardEnrichmentService awardEnrichment)
    {
        _context = context;
        _mapper = mapper;
        _trigger = trigger;
        _eqslClient = eqslClient;
        _weatherService = weatherService;
        _propagationService = propagationService;
        _eqslProtector = dataProtectionProvider.CreateProtector("EqslPassword");
        _qrzProtector = dataProtectionProvider.CreateProtector("QrzApiKey");
        _lotwProtector = dataProtectionProvider.CreateProtector("LotwPassword");
        _awardEnrichment = awardEnrichment;
    }

    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] string? search)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var query = _context.QsoEntries.Where(q => q.UserId == userId);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(q => q.WorkedCallsign.Contains(search) || q.OwnCallsign.Contains(search));

        var qsos = await query.OrderByDescending(q => q.DateUtc).ToListAsync();
        return Ok(qsos.Select(q => _mapper.Map<QsoDto>(q)));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var qso = await _context.QsoEntries.FindAsync(id);
        if (qso == null) return NotFound();
        if (qso.UserId != userId && !User.IsInRole("Admin")) return Forbid();
        return Ok(_mapper.Map<QsoDto>(qso));
    }

    [HttpGet("duplicates")]
    public async Task<IActionResult> GetDuplicates(CancellationToken ct = default)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var qsos = await _context.QsoEntries
            .Where(q => q.UserId == userId)
            .OrderBy(q => q.WorkedCallsign)
            .ThenBy(q => q.Mode)
            .ThenBy(q => q.DateUtc)
            .ToListAsync(ct);

        var groups = FindDuplicateGroups(qsos, userId)
            .Select(group =>
            {
                var ordered = group.OrderByDescending(q => q.DateUtc).ToArray();
                var first = ordered[0];
                return new QsoDuplicateGroupDto(
                    Key: string.Join("-", ordered.Select(q => q.Id)),
                    WorkedCallsign: first.WorkedCallsign,
                    Band: BandToDisplay(first.Band),
                    Mode: first.Mode.ToString(),
                    Reason: "Samme call, band/mode og tidspunkt inden for 60 sekunder eller kendt lokal tids-offset.",
                    Qsos: ordered.Select(q => _mapper.Map<QsoDto>(q)).ToArray());
            })
            .OrderByDescending(group => group.Qsos.Max(q => q.DateUtc))
            .ToArray();

        return Ok(groups);
    }

    [HttpPost("duplicates/merge")]
    public async Task<IActionResult> MergeDuplicate([FromBody] MergeDuplicateQsoDto dto, CancellationToken ct = default)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var duplicateIds = dto.DuplicateIds.Distinct().Where(id => id != dto.KeepId).ToArray();
        if (duplicateIds.Length == 0) return BadRequest("Vælg mindst en dublet der skal flettes.");

        var qsos = await _context.QsoEntries
            .Where(q => q.UserId == userId && (q.Id == dto.KeepId || duplicateIds.Contains(q.Id)))
            .ToListAsync(ct);

        var keep = qsos.SingleOrDefault(q => q.Id == dto.KeepId);
        if (keep == null) return NotFound();
        if (qsos.Count != duplicateIds.Length + 1) return BadRequest("En eller flere QSOer blev ikke fundet.");

        var duplicates = qsos.Where(q => q.Id != dto.KeepId).ToArray();
        if (duplicates.Any(q => !AreDuplicateCandidates(keep, q, userId) && !AreDuplicateCandidates(q, keep, userId)))
            return BadRequest("En eller flere QSOer matcher ikke den valgte QSO som dublet.");

        foreach (var duplicate in duplicates)
        {
            MergeQsoFields(keep, duplicate);
            MergeExternalLogFields(keep, duplicate);
        }

        keep.UpdatedAt = DateTime.UtcNow;
        _context.QsoEntries.RemoveRange(duplicates);
        await _context.SaveChangesAsync(ct);
        _trigger.NotifyQsoChanged(userId);

        return Ok(_mapper.Map<QsoDto>(keep));
    }

    [HttpGet("{id}/external-status")]
    public async Task<IActionResult> GetExternalStatus(int id, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var qso = await _context.QsoEntries
            .Include(q => q.User)
            .FirstOrDefaultAsync(q => q.Id == id);
        if (qso == null) return NotFound();
        if (qso.UserId != userId && !User.IsInRole("Admin")) return Forbid();

        var qrzReadable = CanUnprotect(qso.User.QrzApiKey, _qrzProtector);
        var eqslReadable = CanUnprotect(qso.User.EqslPassword, _eqslProtector);
        var lotwReadable = CanUnprotect(qso.User.LotwPassword, _lotwProtector);
        if (eqslReadable == true)
        {
            try
            {
                await RefreshEqslStatusAsync(qso, ct);
            }
            catch (EqslApiException ex)
            {
                qso.EqslLastResult = $"Kunne ikke opdatere eQSL status: {ex.Message}";
                qso.User.EqslLastSyncedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(ct);
            }
        }

        return Ok(QsoExternalLogStatusBuilder.Build(qso, qso.User, qrzReadable, eqslReadable, lotwReadable));
    }

    [HttpGet("{id}/conditions")]
    public async Task<IActionResult> GetConditions(int id, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var qso = await _context.QsoEntries.FindAsync(new object[] { id }, ct);
        if (qso == null) return NotFound();
        if (qso.UserId != userId && !User.IsInRole("Admin")) return Forbid();

        var conditions = QsoConditionsBuilder.Build(qso);
        var ownWeather = conditions.OwnLocation is null
            ? null
            : await _weatherService.GetHistoricalWeatherAsync(
                conditions.OwnLocation.Latitude,
                conditions.OwnLocation.Longitude,
                conditions.NearestWeatherHourUtc,
                ct);
        var workedWeather = conditions.WorkedLocation is null
            ? null
            : await _weatherService.GetHistoricalWeatherAsync(
                conditions.WorkedLocation.Latitude,
                conditions.WorkedLocation.Longitude,
                conditions.NearestWeatherHourUtc,
                ct);
        var propagation = await _propagationService.GetPropagationAsync(conditions.QsoTimeUtc, ct);

        return Ok(QsoConditionsBuilder.WithPropagation(
            QsoConditionsBuilder.WithWeather(conditions, ownWeather, workedWeather),
            propagation));
    }

    [HttpPost("{id}/eqsl/send")]
    public async Task<IActionResult> SendToEqsl(int id, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var qso = await _context.QsoEntries
            .Include(q => q.User)
            .FirstOrDefaultAsync(q => q.Id == id, ct);
        if (qso == null) return NotFound();
        if (qso.UserId != userId && !User.IsInRole("Admin")) return Forbid();
        if (qso.User.EqslUsername == null || qso.User.EqslPassword == null)
            return BadRequest("eQSL er ikke sat op på profilen");

        string password;
        try
        {
            password = _eqslProtector.Unprotect(qso.User.EqslPassword);
        }
        catch (CryptographicException)
        {
            return BadRequest("eQSL login kunne ikke læses i dette miljø. Gem eQSL login igen på profilen, eller test fra produktionsserveren hvor nøglen blev oprettet.");
        }

        EqslUploadResult result;
        try
        {
            result = await _eqslClient.UploadQsoAsync(ToEqslAdif(qso), qso.User.EqslUsername, password, qso.User.EqslQthNickname, ct);
        }
        catch (EqslApiException ex)
        {
            return BadRequest(ex.Message);
        }

        qso.EqslSentAt = DateTime.UtcNow;
        qso.EqslLastResult = result.Message;
        qso.UpdatedAt = DateTime.UtcNow;
        qso.User.EqslLastSyncedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return Ok(new { result.Success, result.Message, qso.EqslSentAt });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateQsoDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var qso = _mapper.Map<QsoEntry>(dto);
        qso.UserId = userId;
        qso.DateUtc = QsoTime.NormalizeUtc(qso.DateUtc);
        qso.OwnCallsign = qso.OwnCallsign.Trim().ToUpperInvariant();
        qso.WorkedCallsign = qso.WorkedCallsign.Trim().ToUpperInvariant();
        qso.Band = NormalizeBand(qso.Band, qso.Frequency);
        await ApplyDefaultStationGridAsync(userId, qso);
        _awardEnrichment.Enrich(qso);
        qso.UpdatedAt = DateTime.UtcNow;

        var duplicate = await FindDuplicateQsoAsync(userId, qso);
        if (duplicate != null)
        {
            MergeQsoFields(duplicate, qso);
            duplicate.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            _trigger.NotifyQsoChanged(userId);
            return Ok(_mapper.Map<QsoDto>(duplicate));
        }

        _context.QsoEntries.Add(qso);
        await _context.SaveChangesAsync();
        _trigger.NotifyQsoChanged(userId);
        return CreatedAtAction(nameof(GetById), new { id = qso.Id }, _mapper.Map<QsoDto>(qso));
    }

    private static EqslAdifQso ToEqslAdif(QsoEntry qso) => new(
        Call: qso.WorkedCallsign,
        TimeOn: qso.DateUtc,
        Band: BandToAdif(qso.Band),
        Mode: ModeToAdif(qso.Mode),
        FrequencyMhz: qso.Frequency,
        RstSent: qso.RstSent,
        RstReceived: qso.RstReceived,
        Submode: qso.Submode,
        Gridsquare: qso.Locator,
        Comment: qso.Comment);

    private async Task RefreshEqslStatusAsync(QsoEntry qso, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(qso.OwnCallsign) || string.IsNullOrWhiteSpace(qso.WorkedCallsign))
            return;

        var outgoing = await _eqslClient.VerifyQsoAsync(ToEqslVerification(qso, qso.OwnCallsign, qso.WorkedCallsign), ct);
        var incoming = await _eqslClient.VerifyQsoAsync(ToEqslVerification(qso, qso.WorkedCallsign, qso.OwnCallsign), ct);

        var now = DateTime.UtcNow;
        if (outgoing.OnFile && !qso.EqslSentAt.HasValue)
        {
            qso.EqslSentAt = now;
        }

        if (incoming.OnFile && !qso.EqslConfirmedAt.HasValue)
        {
            qso.EqslConfirmedAt = now;
        }

        qso.EqslLastResult = BuildEqslVerificationMessage(outgoing, incoming);
        qso.User.EqslLastSyncedAt = now;
        qso.UpdatedAt = now;
        await _context.SaveChangesAsync(ct);
    }

    private static EqslVerificationQso ToEqslVerification(QsoEntry qso, string callsignFrom, string callsignTo) => new(
        CallsignFrom: callsignFrom,
        CallsignTo: callsignTo,
        DateUtc: qso.DateUtc,
        Band: BandToAdif(qso.Band),
        Mode: ModeToAdif(qso.Mode));

    private static string BuildEqslVerificationMessage(EqslVerificationResult outgoing, EqslVerificationResult incoming)
    {
        if (outgoing.OnFile && incoming.OnFile)
            return incoming.AuthenticityGuaranteed
                ? "eQSL status opdateret: sendt og bekræftet med Authenticity Guaranteed."
                : "eQSL status opdateret: sendt og bekræftet.";
        if (outgoing.OnFile)
            return outgoing.AuthenticityGuaranteed
                ? "eQSL status opdateret: udgående QSO fundet med Authenticity Guaranteed."
                : "eQSL status opdateret: udgående QSO fundet.";
        if (incoming.OnFile)
            return incoming.AuthenticityGuaranteed
                ? "eQSL status opdateret: modpartens eQSL fundet med Authenticity Guaranteed."
                : "eQSL status opdateret: modpartens eQSL fundet.";

        return $"eQSL status opdateret: {outgoing.Message} {incoming.Message}";
    }

    private static bool? CanUnprotect(string? protectedValue, IDataProtector protector)
    {
        if (string.IsNullOrWhiteSpace(protectedValue)) return null;
        try
        {
            protector.Unprotect(protectedValue);
            return true;
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    private static string BandToAdif(Band band) => band switch
    {
        Band.M160 => "160M",
        Band.M80 => "80M",
        Band.M60 => "60M",
        Band.M40 => "40M",
        Band.M30 => "30M",
        Band.M20 => "20M",
        Band.M17 => "17M",
        Band.M15 => "15M",
        Band.M12 => "12M",
        Band.M10 => "10M",
        Band.M6 => "6M",
        Band.M2 => "2M",
        Band.CM70 => "70CM",
        _ => throw new ArgumentOutOfRangeException(nameof(band), band, null)
    };

    private static string ModeToAdif(Mode mode) => mode switch
    {
        Mode.SSB => "SSB",
        Mode.CW => "CW",
        Mode.FT8 => "FT8",
        Mode.FT4 => "FT4",
        Mode.RTTY => "RTTY",
        Mode.DMR => "DMR",
        Mode.FM => "FM",
        Mode.AM => "AM",
        _ => throw new ArgumentOutOfRangeException(nameof(mode), mode, null)
    };

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateQsoDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var qso = await _context.QsoEntries.FindAsync(id);
        if (qso == null) return NotFound();
        if (qso.UserId != userId) return Forbid();

        qso.DateUtc = QsoTime.NormalizeUtc(dto.DateUtc);
        qso.OwnCallsign = dto.OwnCallsign;
        qso.WorkedCallsign = dto.WorkedCallsign;
        qso.Band = NormalizeBand(dto.Band, dto.Frequency);
        qso.Frequency = dto.Frequency;
        qso.Mode = dto.Mode;
        qso.RstSent = dto.RstSent;
        qso.RstReceived = dto.RstReceived;
        qso.Submode = dto.Submode;
        qso.Locator = dto.Locator;
        qso.MyGridsquare = dto.MyGridsquare;
        qso.Country = dto.Country;
        qso.Dxcc = dto.Dxcc;
        qso.Continent = dto.Continent;
        qso.State = dto.State;
        qso.CqZone = dto.CqZone;
        qso.ItuZone = dto.ItuZone;
        qso.County = dto.County;
        qso.MyState = dto.MyState;
        qso.MyCounty = dto.MyCounty;
        qso.Iota = dto.Iota;
        qso.PotaRefs = dto.PotaRefs;
        qso.SotaRefs = dto.SotaRefs;
        qso.AwardRefs = dto.AwardRefs;
        qso.Name = dto.Name;
        qso.Qth = dto.Qth;
        qso.TxPower = dto.TxPower;
        qso.Comment = dto.Comment;
        qso.UpdatedAt = DateTime.UtcNow;
        // Clear QrzId so the sync service re-uploads the edited record to QRZ as a new entry.
        qso.QrzId = null;
        qso.QrzConfirmationStatus = null;
        qso.QrzConfirmedAt = null;
        qso.QrzQslDate = null;
        qso.LotwConfirmedAt = null;
        qso.LotwQslDate = null;
        qso.LotwLastResult = null;

        await _context.SaveChangesAsync();
        _trigger.NotifyQsoChanged(userId!);
        return Ok(_mapper.Map<QsoDto>(qso));
    }

    private async Task<QsoEntry?> FindDuplicateQsoAsync(string userId, QsoEntry qso, CancellationToken ct = default)
    {
        var lower = qso.DateUtc.AddHours(-2).AddSeconds(-60);
        var upper = qso.DateUtc.AddHours(2).AddSeconds(60);
        var candidates = await _context.QsoEntries
            .Where(existing =>
                existing.UserId == userId &&
                existing.WorkedCallsign == qso.WorkedCallsign &&
                existing.DateUtc >= lower &&
                existing.DateUtc <= upper &&
                existing.Mode == qso.Mode)
            .OrderByDescending(existing => existing.UpdatedAt)
            .ToListAsync(ct);

        return candidates.FirstOrDefault(existing => QsoIdentity.IsDuplicateCandidate(
            existing,
            userId,
            qso.OwnCallsign,
            qso.WorkedCallsign,
            qso.DateUtc,
            qso.Band,
            qso.Mode,
            TimeSpan.FromSeconds(60),
            allowLocalTimeOffset: true));
    }

    private static IReadOnlyList<IReadOnlyList<QsoEntry>> FindDuplicateGroups(IReadOnlyList<QsoEntry> qsos, string userId)
    {
        var parents = qsos.ToDictionary(q => q.Id, q => q.Id);

        int Find(int id)
        {
            while (parents[id] != id)
            {
                parents[id] = parents[parents[id]];
                id = parents[id];
            }

            return id;
        }

        void Union(int left, int right)
        {
            var leftRoot = Find(left);
            var rightRoot = Find(right);
            if (leftRoot != rightRoot) parents[rightRoot] = leftRoot;
        }

        foreach (var bucket in qsos.GroupBy(q => $"{q.WorkedCallsign.Trim().ToUpperInvariant()}|{q.Mode}"))
        {
            var ordered = bucket.OrderBy(q => q.DateUtc).ToArray();
            for (var i = 0; i < ordered.Length; i++)
            {
                for (var j = i + 1; j < ordered.Length; j++)
                {
                    var delta = ordered[j].DateUtc - ordered[i].DateUtc;
                    if (delta > TimeSpan.FromHours(2).Add(TimeSpan.FromSeconds(60))) break;
                    if (AreDuplicateCandidates(ordered[i], ordered[j], userId)) Union(ordered[i].Id, ordered[j].Id);
                }
            }
        }

        return qsos
            .GroupBy(q => Find(q.Id))
            .Select(group => (IReadOnlyList<QsoEntry>)group.OrderByDescending(q => q.DateUtc).ToArray())
            .Where(group => group.Count > 1)
            .OrderByDescending(group => group.Max(q => q.DateUtc))
            .ToArray();
    }

    private static bool AreDuplicateCandidates(QsoEntry existing, QsoEntry incoming, string userId) =>
        existing.Id != incoming.Id &&
        QsoIdentity.IsDuplicateCandidate(
            existing,
            userId,
            incoming.OwnCallsign,
            incoming.WorkedCallsign,
            incoming.DateUtc,
            incoming.Band,
            incoming.Mode,
            TimeSpan.FromSeconds(60),
            allowLocalTimeOffset: true);

    private static Band NormalizeBand(Band band, double? frequency)
    {
        if (Enum.IsDefined(band) && (int)band != 0) return band;
        return QsoIdentity.InferBandFromFrequency(frequency) ?? band;
    }

    private static string BandToDisplay(Band band) => band switch
    {
        Band.M160 => "160m",
        Band.M80 => "80m",
        Band.M60 => "60m",
        Band.M40 => "40m",
        Band.M30 => "30m",
        Band.M20 => "20m",
        Band.M17 => "17m",
        Band.M15 => "15m",
        Band.M12 => "12m",
        Band.M10 => "10m",
        Band.M6 => "6m",
        Band.M2 => "2m",
        Band.CM70 => "70cm",
        _ => band.ToString()
    };

    private async Task ApplyDefaultStationGridAsync(string userId, QsoEntry qso, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(qso.MyGridsquare)) return;

        var defaultGrid = await _context.Users
            .Where(u => u.Id == userId && u.DefaultStationId != null)
            .Join(
                _context.StationProfiles,
                user => user.DefaultStationId,
                station => station.Id,
                (user, station) => new { station.UserId, station.GridLocator })
            .Where(station => station.UserId == userId && station.GridLocator != null && station.GridLocator != "")
            .Select(station => station.GridLocator)
            .FirstOrDefaultAsync(ct);

        qso.MyGridsquare = NormalizeGrid(defaultGrid);
    }

    private static string? NormalizeGrid(string? grid)
    {
        var normalized = grid?.Trim().ToUpperInvariant();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private static void MergeQsoFields(QsoEntry target, QsoEntry incoming)
    {
        target.Band = NormalizeBand(target.Band, target.Frequency) is var normalizedTarget && (int)normalizedTarget != 0
            ? normalizedTarget
            : NormalizeBand(incoming.Band, incoming.Frequency);
        target.Frequency ??= incoming.Frequency;
        target.RstSent ??= incoming.RstSent;
        target.RstReceived ??= incoming.RstReceived;
        target.Submode ??= incoming.Submode;
        target.Locator ??= incoming.Locator;
        target.MyGridsquare ??= incoming.MyGridsquare;
        target.Country ??= incoming.Country;
        target.Dxcc ??= incoming.Dxcc;
        target.Continent ??= incoming.Continent;
        target.State ??= incoming.State;
        target.CqZone ??= incoming.CqZone;
        target.ItuZone ??= incoming.ItuZone;
        target.County ??= incoming.County;
        target.MyState ??= incoming.MyState;
        target.MyCounty ??= incoming.MyCounty;
        target.Iota ??= incoming.Iota;
        target.PotaRefs ??= incoming.PotaRefs;
        target.SotaRefs ??= incoming.SotaRefs;
        target.AwardRefs ??= incoming.AwardRefs;
        target.Name ??= incoming.Name;
        target.Qth ??= incoming.Qth;
        target.TxPower ??= incoming.TxPower;
        target.Comment ??= incoming.Comment;
    }

    private static void MergeExternalLogFields(QsoEntry target, QsoEntry incoming)
    {
        target.QrzId ??= incoming.QrzId;
        target.QrzConfirmationStatus ??= incoming.QrzConfirmationStatus;
        target.QrzConfirmedAt ??= incoming.QrzConfirmedAt;
        target.QrzQslDate ??= incoming.QrzQslDate;
        target.EqslSentAt ??= incoming.EqslSentAt;
        target.EqslConfirmedAt ??= incoming.EqslConfirmedAt;
        target.EqslLastResult ??= incoming.EqslLastResult;
        target.LotwConfirmedAt ??= incoming.LotwConfirmedAt;
        target.LotwQslDate ??= incoming.LotwQslDate;
        target.LotwLastResult ??= incoming.LotwLastResult;
    }

    [HttpPost("import/adif")]
    public async Task<IActionResult> ImportAdif(IFormFile file)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        if (file == null || file.Length == 0) return BadRequest("No file provided");

        using var reader = new System.IO.StreamReader(file.OpenReadStream());
        var content = await reader.ReadToEndAsync();

        var bandMap = new Dictionary<string, HamHub.Domain.Enums.Band>(StringComparer.OrdinalIgnoreCase)
        {
            ["160M"] = HamHub.Domain.Enums.Band.M160, ["80M"] = HamHub.Domain.Enums.Band.M80,
            ["60M"] = HamHub.Domain.Enums.Band.M60,   ["40M"] = HamHub.Domain.Enums.Band.M40,
            ["30M"] = HamHub.Domain.Enums.Band.M30,   ["20M"] = HamHub.Domain.Enums.Band.M20,
            ["17M"] = HamHub.Domain.Enums.Band.M17,   ["15M"] = HamHub.Domain.Enums.Band.M15,
            ["12M"] = HamHub.Domain.Enums.Band.M12,   ["10M"] = HamHub.Domain.Enums.Band.M10,
            ["6M"]  = HamHub.Domain.Enums.Band.M6,    ["2M"]  = HamHub.Domain.Enums.Band.M2,
            ["70CM"] = HamHub.Domain.Enums.Band.CM70, ["70CM"]= HamHub.Domain.Enums.Band.CM70
        };
        var modeMap = new Dictionary<string, HamHub.Domain.Enums.Mode>(StringComparer.OrdinalIgnoreCase)
        {
            ["SSB"] = HamHub.Domain.Enums.Mode.SSB, ["CW"]   = HamHub.Domain.Enums.Mode.CW,
            ["FT8"] = HamHub.Domain.Enums.Mode.FT8, ["FT4"]  = HamHub.Domain.Enums.Mode.FT4,
            ["RTTY"]= HamHub.Domain.Enums.Mode.RTTY,["DMR"]  = HamHub.Domain.Enums.Mode.DMR,
            ["FM"]  = HamHub.Domain.Enums.Mode.FM,  ["AM"]   = HamHub.Domain.Enums.Mode.AM,
            ["USB"] = HamHub.Domain.Enums.Mode.SSB, ["LSB"]  = HamHub.Domain.Enums.Mode.SSB
        };

        static string? GetField(string record, string name)
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

        var records = content.Split("<EOR>", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        int imported = 0, skipped = 0, merged = 0;

        foreach (var rec in records)
        {
            var call = GetField(rec, "CALL");
            var dateStr = GetField(rec, "QSO_DATE");
            var timeStr = GetField(rec, "TIME_ON") ?? "0000";
            var bandStr = GetField(rec, "BAND");
            var modeStr = GetField(rec, "MODE");

            if (call == null || dateStr == null || bandStr == null || modeStr == null) { skipped++; continue; }
            if (!bandMap.TryGetValue(bandStr, out var band)) { skipped++; continue; }
            if (!modeMap.TryGetValue(modeStr, out var mode)) { skipped++; continue; }

            if (!DateTime.TryParseExact(dateStr + timeStr.PadRight(6, '0')[..6],
                "yyyyMMddHHmmss",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
                out var dt))
            { skipped++; continue; }

            var ownCall = GetField(rec, "STATION_CALLSIGN") ?? GetField(rec, "MY_CALLSIGN") ?? "";
            var qso = new HamHub.Domain.Entities.QsoEntry
            {
                UserId = userId,
                OwnCallsign = ownCall,
                WorkedCallsign = call.ToUpper(),
                Band = band,
                Mode = mode,
                DateUtc = QsoTime.NormalizeUtc(dt),
                Frequency = double.TryParse(GetField(rec, "FREQ"), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var freq) ? freq : null,
                RstSent = GetField(rec, "RST_SENT"),
                RstReceived = GetField(rec, "RST_RCVD"),
                Submode = GetField(rec, "SUBMODE"),
                Country = GetField(rec, "COUNTRY"),
                Dxcc = int.TryParse(GetField(rec, "DXCC"), out var dxcc) ? dxcc : null,
                CqZone = int.TryParse(GetField(rec, "CQZ"), out var cqz) ? cqz : null,
                ItuZone = int.TryParse(GetField(rec, "ITUZ"), out var ituz) ? ituz : null,
                Continent = GetField(rec, "CONT"),
                State = GetField(rec, "STATE"),
                County = NormalizeAwardText(GetField(rec, "CNTY")),
                MyState = NormalizeAwardText(GetField(rec, "MY_STATE")),
                MyCounty = NormalizeAwardText(GetField(rec, "MY_CNTY")),
                Iota = GetField(rec, "IOTA"),
                PotaRefs = NormalizeAwardText(GetField(rec, "POTA_REF") ?? GetField(rec, "POTA_REFS")),
                SotaRefs = NormalizeAwardText(GetField(rec, "SOTA_REF") ?? GetField(rec, "SOTA_REFS")),
                AwardRefs = NormalizeAwardText(GetField(rec, "AWARD_SUBMITTED") ?? GetField(rec, "AWARD_GRANTED")),
                Name = GetField(rec, "NAME"),
                Qth = GetField(rec, "QTH"),
                TxPower = double.TryParse(GetField(rec, "TX_PWR"), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var pwr) ? pwr : null,
                Locator = GetField(rec, "GRIDSQUARE"),
                MyGridsquare = GetField(rec, "MY_GRIDSQUARE"),
                Comment = GetField(rec, "COMMENT") ?? GetField(rec, "NOTES"),
            };
            await ApplyDefaultStationGridAsync(userId, qso);

            var duplicate = await FindDuplicateQsoAsync(userId, qso);
            if (duplicate != null)
            {
                MergeQsoFields(duplicate, qso);
                duplicate.UpdatedAt = DateTime.UtcNow;
                merged++;
            }
            else
            {
                _context.QsoEntries.Add(qso);
                imported++;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { imported, skipped, merged });
    }

    [HttpGet("export/adif")]
    public async Task<IActionResult> ExportAdif()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var qsos = await _context.QsoEntries
            .Where(q => q.UserId == userId)
            .OrderByDescending(q => q.DateUtc)
            .ToListAsync();

        var bandAdif = new Dictionary<HamHub.Domain.Enums.Band, string>
        {
            [HamHub.Domain.Enums.Band.M160] = "160M", [HamHub.Domain.Enums.Band.M80] = "80M",
            [HamHub.Domain.Enums.Band.M60] = "60M",  [HamHub.Domain.Enums.Band.M40] = "40M",
            [HamHub.Domain.Enums.Band.M30] = "30M",  [HamHub.Domain.Enums.Band.M20] = "20M",
            [HamHub.Domain.Enums.Band.M17] = "17M",  [HamHub.Domain.Enums.Band.M15] = "15M",
            [HamHub.Domain.Enums.Band.M12] = "12M",  [HamHub.Domain.Enums.Band.M10] = "10M",
            [HamHub.Domain.Enums.Band.M6]  = "6M",   [HamHub.Domain.Enums.Band.M2]  = "2M",
            [HamHub.Domain.Enums.Band.CM70] = "70CM"
        };
        var modeAdif = new Dictionary<HamHub.Domain.Enums.Mode, string>
        {
            [HamHub.Domain.Enums.Mode.SSB] = "SSB", [HamHub.Domain.Enums.Mode.CW]   = "CW",
            [HamHub.Domain.Enums.Mode.FT8] = "FT8", [HamHub.Domain.Enums.Mode.FT4]  = "FT4",
            [HamHub.Domain.Enums.Mode.RTTY]= "RTTY",[HamHub.Domain.Enums.Mode.DMR]  = "DMR",
            [HamHub.Domain.Enums.Mode.FM]  = "FM",  [HamHub.Domain.Enums.Mode.AM]   = "AM"
        };

        static string F(string n, string v) => $"<{n}:{v.Length}>{v}";
        var lines = new System.Text.StringBuilder();
        lines.AppendLine("<ADIF_VER:5>3.1.4");
        lines.AppendLine("<PROGRAMID:6>HamHub");
        lines.AppendLine("<EOH>");
        foreach (var q in qsos)
        {
            lines.Append(F("CALL", q.WorkedCallsign));
            lines.Append(F("BAND", bandAdif[q.Band]));
            lines.Append(F("MODE", modeAdif[q.Mode]));
            lines.Append(F("QSO_DATE", q.DateUtc.ToString("yyyyMMdd")));
            lines.Append(F("TIME_ON", q.DateUtc.ToString("HHmm")));
            if (!string.IsNullOrEmpty(q.OwnCallsign)) lines.Append(F("STATION_CALLSIGN", q.OwnCallsign));
            if (!string.IsNullOrEmpty(q.Submode)) lines.Append(F("SUBMODE", q.Submode));
            if (q.Frequency.HasValue) lines.Append(F("FREQ", q.Frequency.Value.ToString("F3", System.Globalization.CultureInfo.InvariantCulture)));
            if (!string.IsNullOrEmpty(q.RstSent)) lines.Append(F("RST_SENT", q.RstSent));
            if (!string.IsNullOrEmpty(q.RstReceived)) lines.Append(F("RST_RCVD", q.RstReceived));
            if (!string.IsNullOrEmpty(q.Name)) lines.Append(F("NAME", q.Name));
            if (!string.IsNullOrEmpty(q.Qth)) lines.Append(F("QTH", q.Qth));
            if (!string.IsNullOrEmpty(q.Country)) lines.Append(F("COUNTRY", q.Country));
            if (q.Dxcc.HasValue) lines.Append(F("DXCC", q.Dxcc.Value.ToString()));
            if (q.CqZone.HasValue) lines.Append(F("CQZ", q.CqZone.Value.ToString()));
            if (q.ItuZone.HasValue) lines.Append(F("ITUZ", q.ItuZone.Value.ToString()));
            if (!string.IsNullOrEmpty(q.Continent)) lines.Append(F("CONT", q.Continent));
            if (!string.IsNullOrEmpty(q.State)) lines.Append(F("STATE", q.State));
            if (!string.IsNullOrEmpty(q.County)) lines.Append(F("CNTY", q.County));
            if (!string.IsNullOrEmpty(q.MyState)) lines.Append(F("MY_STATE", q.MyState));
            if (!string.IsNullOrEmpty(q.MyCounty)) lines.Append(F("MY_CNTY", q.MyCounty));
            if (!string.IsNullOrEmpty(q.Iota)) lines.Append(F("IOTA", q.Iota));
            if (!string.IsNullOrEmpty(q.PotaRefs)) lines.Append(F("POTA_REF", q.PotaRefs));
            if (!string.IsNullOrEmpty(q.SotaRefs)) lines.Append(F("SOTA_REF", q.SotaRefs));
            if (!string.IsNullOrEmpty(q.AwardRefs)) lines.Append(F("AWARD_SUBMITTED", q.AwardRefs));
            if (!string.IsNullOrEmpty(q.Locator)) lines.Append(F("GRIDSQUARE", q.Locator));
            if (!string.IsNullOrEmpty(q.MyGridsquare)) lines.Append(F("MY_GRIDSQUARE", q.MyGridsquare));
            if (q.TxPower.HasValue) lines.Append(F("TX_PWR", q.TxPower.Value.ToString("F1", System.Globalization.CultureInfo.InvariantCulture)));
            if (!string.IsNullOrEmpty(q.Comment)) lines.Append(F("COMMENT", q.Comment));
            lines.AppendLine("<EOR>");
        }

        var filename = $"hamhub-logbog-{DateTime.UtcNow:yyyy-MM-dd}.adi";
        return File(System.Text.Encoding.UTF8.GetBytes(lines.ToString()), "text/plain", filename);
    }

    private static string? NormalizeAwardText(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized.ToUpperInvariant();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var qso = await _context.QsoEntries.FindAsync(id);
        if (qso == null) return NotFound();
        if (qso.UserId != userId && !User.IsInRole("Admin")) return Forbid();

        _context.QsoEntries.Remove(qso);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

public record QsoDuplicateGroupDto(
    string Key,
    string WorkedCallsign,
    string Band,
    string Mode,
    string Reason,
    QsoDto[] Qsos);

public record MergeDuplicateQsoDto(int KeepId, int[] DuplicateIds);
