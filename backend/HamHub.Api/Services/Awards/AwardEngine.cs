using HamHub.Domain.Entities;
using HamHub.Domain.Enums;

namespace HamHub.Api.Services.Awards;

public class AwardEngine
{
    public AwardSummaryResponse Calculate(IEnumerable<QsoEntry> qsos, AwardQuery query)
    {
        var filteredQsos = ApplyFilters(qsos, query).ToArray();
        var awards = AwardCatalog.All
            .Where(definition => string.IsNullOrWhiteSpace(query.Sponsor) || string.Equals(definition.Sponsor, query.Sponsor, StringComparison.OrdinalIgnoreCase))
            .Where(definition => string.IsNullOrWhiteSpace(query.Status) || string.Equals(definition.Status, query.Status, StringComparison.OrdinalIgnoreCase))
            .Select(definition => CalculateAward(definition, filteredQsos))
            .ToArray();

        return new AwardSummaryResponse(awards);
    }

    public AwardDetailResponse? Detail(IEnumerable<QsoEntry> qsos, string id, AwardQuery query)
    {
        var definition = AwardCatalog.All.FirstOrDefault(item => string.Equals(item.Id, id, StringComparison.OrdinalIgnoreCase));
        if (definition is null) return null;
        return new AwardDetailResponse(CalculateAward(definition, ApplyFilters(qsos, query).ToArray()));
    }

    private static IEnumerable<QsoEntry> ApplyFilters(IEnumerable<QsoEntry> qsos, AwardQuery query)
    {
        return qsos
            .Where(qso => string.IsNullOrWhiteSpace(query.Callsign) || string.Equals(qso.OwnCallsign, query.Callsign, StringComparison.OrdinalIgnoreCase))
            .Where(qso => query.Band is null || qso.Band == query.Band)
            .Where(qso => query.Mode is null || qso.Mode == query.Mode);
    }

    private static AwardProgressDto CalculateAward(AwardDefinition definition, QsoEntry[] qsos)
    {
        if (definition.Status != "active")
        {
            return new AwardProgressDto(
                definition.Id,
                definition.Sponsor,
                definition.Name,
                definition.Description,
                definition.Status,
                definition.RuleType,
                WorkedCount: 0,
                ConfirmedCount: 0,
                MissingCount: 0,
                NextThreshold: definition.Thresholds.FirstOrDefault(),
                definition.DataRequirements,
                Warnings: new[] { $"Award kræver datafelter: {string.Join(", ", definition.DataRequirements)}." },
                Entities: Array.Empty<AwardEntityProgressDto>(),
                MissingEntities: Array.Empty<AwardEntityProgressDto>(),
                UnconfirmedEntities: Array.Empty<AwardEntityProgressDto>());
        }

        var worked = new Dictionary<string, AwardEntityProgressDto>(StringComparer.OrdinalIgnoreCase);
        var confirmed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var qso in qsos)
        {
            foreach (var (key, label) in EntitiesFor(definition.RuleType, qso))
            {
                if (!worked.ContainsKey(key))
                    worked[key] = new AwardEntityProgressDto(key, label, "worked", qso.Id == 0 ? null : qso.Id);

                if (IsConfirmed(qso))
                    confirmed.Add(key);
            }
        }

        var entities = worked.Values
            .Select(entity => confirmed.Contains(entity.Key) ? entity with { Status = "confirmed" } : entity)
            .OrderBy(entity => entity.Key, StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var missing = MissingEntities(definition, worked.Keys).ToArray();
        var unconfirmed = entities.Where(entity => entity.Status == "worked").ToArray();

        return new AwardProgressDto(
            definition.Id,
            definition.Sponsor,
            definition.Name,
            definition.Description,
            definition.Status,
            definition.RuleType,
            WorkedCount: worked.Count,
            ConfirmedCount: confirmed.Count,
            MissingCount: missing.Length,
            NextThreshold: NextThreshold(definition.Thresholds, worked.Count),
            definition.DataRequirements,
            Warnings: Array.Empty<string>(),
            Entities: entities,
            MissingEntities: missing,
            UnconfirmedEntities: unconfirmed);
    }

    private static IEnumerable<(string Key, string Label)> EntitiesFor(string ruleType, QsoEntry qso)
    {
        (string Key, string Label)? entity = ruleType switch
        {
            "dxcc" or "confirmed-dxcc" => qso.Dxcc.HasValue && qso.Dxcc.Value > 0
                ? (qso.Dxcc.Value.ToString(), qso.Country ?? qso.Dxcc.Value.ToString())
                : null,
            "dxcc-band" => qso.Dxcc.HasValue && qso.Dxcc.Value > 0
                ? ($"{qso.Dxcc.Value}|{qso.Band}", $"{qso.Country ?? qso.Dxcc.Value.ToString()} / {BandLabel(qso.Band)}")
                : null,
            "dxcc-mode" => qso.Dxcc.HasValue && qso.Dxcc.Value > 0
                ? ($"{qso.Dxcc.Value}|{qso.Mode}", $"{qso.Country ?? qso.Dxcc.Value.ToString()} / {qso.Mode}")
                : null,
            "cont" => Normalize(qso.Continent) is { Length: > 0 } continent ? (continent, continent) : null,
            "px" => Prefix(qso.WorkedCallsign) is { Length: > 0 } prefix ? (prefix, prefix) : null,
            "grids" => Normalize(qso.Locator) is { Length: >= 4 } grid ? (grid[..4], grid[..4]) : null,
            "cqz" => qso.CqZone is >= 1 and <= 40 ? (qso.CqZone.Value.ToString(), qso.CqZone.Value.ToString()) : null,
            "ituz" => qso.ItuZone is >= 1 and <= 75 ? (qso.ItuZone.Value.ToString(), qso.ItuZone.Value.ToString()) : null,
            "states-us" => IsUsDxcc(qso.Dxcc) && Normalize(qso.State) is { Length: 2 } usState && IsUsState(usState) ? (usState, usState) : null,
            "states-ca" => qso.Dxcc == 1 && Normalize(qso.State) is { Length: 2 } caProvince && IsCanadianProvince(caProvince) ? (caProvince, caProvince) : null,
            "cnty" => Normalize(qso.County) is { Length: > 0 } county ? (county, county) : null,
            "iota" => Normalize(qso.Iota) is { Length: > 0 } iota ? (iota, iota) : null,
            _ => null,
        };

        if (entity is not null)
        {
            yield return entity.Value;
            yield break;
        }

        var refs = ruleType switch
        {
            "pota" => ReferenceValues(qso.PotaRefs),
            "sota" => ReferenceValues(qso.SotaRefs),
            _ => Array.Empty<string>()
        };

        foreach (var reference in refs)
            yield return (reference, reference);
    }

    private static IEnumerable<AwardEntityProgressDto> MissingEntities(AwardDefinition definition, IEnumerable<string> workedKeys)
    {
        if (definition.EntityUniverse is null) yield break;

        var worked = new HashSet<string>(workedKeys, StringComparer.OrdinalIgnoreCase);
        foreach (var key in definition.EntityUniverse.Where(key => !worked.Contains(key)))
            yield return new AwardEntityProgressDto(key, key, "missing", null);
    }

    private static int? NextThreshold(int[] thresholds, int workedCount) =>
        thresholds.OrderBy(item => item).FirstOrDefault(item => item > workedCount) is var next && next > 0 ? next : null;

    private static bool IsConfirmed(QsoEntry qso) =>
        qso.LotwConfirmedAt.HasValue ||
        qso.EqslConfirmedAt.HasValue ||
        qso.QrzConfirmedAt.HasValue ||
        string.Equals(qso.QrzConfirmationStatus, "C", StringComparison.OrdinalIgnoreCase);

    private static string Normalize(string? value) => value?.Trim().ToUpperInvariant() ?? string.Empty;

    private static string[] ReferenceValues(string? value) =>
        Normalize(value)
            .Split(new[] { ',', ';', ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private static bool IsUsDxcc(int? dxcc) => dxcc is 6 or 110 or 291;

    private static bool IsUsState(string state) => UsStates.Contains(state, StringComparer.OrdinalIgnoreCase);

    private static bool IsCanadianProvince(string province) => CanadianProvinces.Contains(province, StringComparer.OrdinalIgnoreCase);

    private static string? Prefix(string? callsign)
    {
        var normalized = Normalize(callsign);
        if (normalized.Length == 0) return null;

        var slashIndex = normalized.IndexOf('/', StringComparison.Ordinal);
        if (slashIndex > 0) normalized = normalized[..slashIndex];

        var lastDigit = normalized.Select((character, index) => (character, index))
            .Where(item => char.IsDigit(item.character))
            .Select(item => item.index)
            .DefaultIfEmpty(-1)
            .Max();

        return lastDigit >= 0 ? normalized[..(lastDigit + 1)] : normalized[..Math.Min(3, normalized.Length)];
    }

    private static string BandLabel(Band band) => band switch
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

    private static readonly string[] UsStates =
    {
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
    };

    private static readonly string[] CanadianProvinces =
    {
        "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"
    };
}
