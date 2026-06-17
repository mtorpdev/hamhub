using System.Globalization;
using System.Text.RegularExpressions;

namespace HamHub.Api.Services;

public sealed class DxccLookupService
{
    private readonly IReadOnlyList<DxccEntry> _entries;
    private readonly IReadOnlyDictionary<string, DxccEntry> _exactAliases;
    private readonly IReadOnlyDictionary<string, DxccEntry> _prefixAliases;
    private readonly IReadOnlyDictionary<string, int> _adifCodes;

    public DxccLookupService(IWebHostEnvironment environment, ILogger<DxccLookupService> logger)
    {
        var path = Path.Combine(environment.ContentRootPath, "Data", "cty.dat");
        var adifPath = Path.Combine(environment.ContentRootPath, "Data", "dxcc-entity-codes.csv");
        _adifCodes = File.Exists(adifPath)
            ? LoadAdifCodes(File.ReadLines(adifPath))
            : new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        if (!File.Exists(path))
        {
            logger.LogWarning("DXCC country file was not found at {Path}", path);
            _entries = Array.Empty<DxccEntry>();
            _exactAliases = new Dictionary<string, DxccEntry>(StringComparer.OrdinalIgnoreCase);
            _prefixAliases = new Dictionary<string, DxccEntry>(StringComparer.OrdinalIgnoreCase);
            return;
        }

        _entries = Parse(File.ReadLines(path));
        _exactAliases = _entries
            .SelectMany(entry => entry.Aliases.Where(alias => alias.Exact).Select(alias => (alias.Prefix, Entry: entry)))
            .GroupBy(item => item.Prefix, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().Entry, StringComparer.OrdinalIgnoreCase);
        _prefixAliases = _entries
            .SelectMany(entry => entry.Aliases.Where(alias => !alias.Exact).Select(alias => (alias.Prefix, Entry: entry)))
            .GroupBy(item => item.Prefix, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().Entry, StringComparer.OrdinalIgnoreCase);

        logger.LogInformation("Loaded {EntityCount} DXCC entities and {AliasCount} prefix/callsign aliases from CTY.DAT.",
            _entries.Count,
            _exactAliases.Count + _prefixAliases.Count);
    }

    public DxccLookupResult? Lookup(string? callsign)
    {
        var normalized = NormalizeCallsign(callsign);
        if (string.IsNullOrWhiteSpace(normalized)) return null;

        foreach (var candidate in BuildCandidates(normalized))
        {
            if (_exactAliases.TryGetValue(candidate, out var exactEntry))
                return ToResult(candidate, candidate, exactEntry);
        }

        DxccEntry? bestEntry = null;
        string? bestPrefix = null;
        string? bestCandidate = null;
        foreach (var candidate in BuildCandidates(normalized))
        {
            foreach (var (prefix, entry) in _prefixAliases)
            {
                if (!candidate.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;
                if (bestPrefix is null || prefix.Length > bestPrefix.Length)
                {
                    bestPrefix = prefix;
                    bestCandidate = candidate;
                    bestEntry = entry;
                }
            }
        }

        return bestEntry is null || bestPrefix is null || bestCandidate is null ? null : ToResult(bestPrefix, bestCandidate, bestEntry);
    }

    internal static IReadOnlyList<DxccEntry> Parse(IEnumerable<string> lines)
    {
        var entries = new List<DxccEntry>();
        DxccEntryBuilder? current = null;

        foreach (var rawLine in lines)
        {
            if (string.IsNullOrWhiteSpace(rawLine)) continue;
            var line = rawLine.TrimEnd();
            var headerParts = line.Split(':');
            if (headerParts.Length >= 8 && !char.IsWhiteSpace(rawLine[0]))
            {
                if (current is not null) entries.Add(current.Build());
                current = new DxccEntryBuilder(
                    Name: headerParts[0].Trim(),
                    CqZone: ParseInt(headerParts[1]),
                    ItuZone: ParseInt(headerParts[2]),
                    Continent: headerParts[3].Trim().ToUpperInvariant(),
                    Latitude: ParseDouble(headerParts[4]),
                    Longitude: ParseDouble(headerParts[5]),
                    UtcOffset: ParseDouble(headerParts[6]),
                    PrimaryPrefix: CleanAliasPrefix(headerParts[7]).Prefix);
                continue;
            }

            if (current is null) continue;
            foreach (var aliasPart in line.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var alias = CleanAliasPrefix(aliasPart.TrimEnd(';'));
                if (!string.IsNullOrWhiteSpace(alias.Prefix))
                    current.Aliases.Add(alias);
            }
        }

        if (current is not null) entries.Add(current.Build());
        return entries;
    }

    private DxccLookupResult ToResult(string matchedPrefix, string wpxSource, DxccEntry entry)
    {
        return new DxccLookupResult(
            Country: entry.Name,
            Dxcc: ResolveAdifCode(entry.Name),
            Continent: entry.Continent,
            PrimaryPrefix: entry.PrimaryPrefix,
            MatchedPrefix: matchedPrefix,
            WpxPrefix: BuildWpxPrefix(wpxSource),
            CqZone: entry.CqZone,
            ItuZone: entry.ItuZone,
            Latitude: entry.Latitude,
            Longitude: entry.Longitude,
            UtcOffset: entry.UtcOffset);
    }

    private int? ResolveAdifCode(string entityName)
    {
        var normalized = NormalizeEntityName(entityName);
        return _adifCodes.TryGetValue(normalized, out var code) ? code : null;
    }

    private static IEnumerable<string> BuildCandidates(string normalized)
    {
        var parts = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0) yield break;
        if (parts.Length == 1)
        {
            yield return parts[0];
            yield break;
        }

        var portableSuffixes = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "P", "M", "MM", "AM", "QRP" };
        foreach (var part in parts.Where(part => !portableSuffixes.Contains(part)))
            yield return part;
    }

    private static string NormalizeCallsign(string? callsign) =>
        Regex.Replace(callsign?.Trim().ToUpperInvariant() ?? string.Empty, @"[^A-Z0-9/]", "");

    private static Dictionary<string, int> LoadAdifCodes(IEnumerable<string> lines)
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var header = Array.Empty<string>();

        foreach (var line in lines)
        {
            var columns = SplitCsv(line);
            if (columns.Length == 0) continue;
            if (columns[0].Equals("Enumeration Name", StringComparison.OrdinalIgnoreCase))
            {
                header = columns;
                continue;
            }

            var codeIndex = Array.FindIndex(header, item => item.Equals("Entity Code", StringComparison.OrdinalIgnoreCase));
            var nameIndex = Array.FindIndex(header, item => item.Equals("Entity Name", StringComparison.OrdinalIgnoreCase));
            var deletedIndex = Array.FindIndex(header, item => item.Equals("Deleted", StringComparison.OrdinalIgnoreCase));
            if (codeIndex < 0 || nameIndex < 0) continue;
            if (deletedIndex >= 0 && !string.IsNullOrWhiteSpace(columns.ElementAtOrDefault(deletedIndex))) continue;
            if (!int.TryParse(columns.ElementAtOrDefault(codeIndex), NumberStyles.Integer, CultureInfo.InvariantCulture, out var code)) continue;

            var name = NormalizeEntityName(columns.ElementAtOrDefault(nameIndex));
            if (name.Length > 0) result.TryAdd(name, code);
        }

        return result;
    }

    private static string NormalizeEntityName(string? value)
    {
        var normalized = Regex.Replace(value?.ToUpperInvariant() ?? string.Empty, @"\b(IS\.?|ISLANDS?|THE|OF|AND)\b", " ");
        normalized = normalized.Replace("&", " ");
        normalized = Regex.Replace(normalized, @"[^A-Z0-9]", " ");
        normalized = Regex.Replace(normalized, @"\s+", " ").Trim();
        if (normalized == "FED REP GERMANY") return "FED REP GERMANY";
        if (normalized == "UNITED STATES" || normalized == "UNITED STATES AMERICA") return "UNITED STATES AMERICA";
        return normalized;
    }

    private static string[] SplitCsv(string line)
    {
        var result = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var character = line[i];
            if (character == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (character == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
                continue;
            }

            current.Append(character);
        }

        result.Add(current.ToString());
        return result.ToArray();
    }

    private static string BuildWpxPrefix(string prefix)
    {
        var normalized = Regex.Replace(prefix.ToUpperInvariant(), @"[^A-Z0-9]", "");
        if (string.IsNullOrWhiteSpace(normalized)) return string.Empty;
        var lastDigit = normalized.Select((character, index) => (character, index))
            .Where(item => char.IsDigit(item.character))
            .Select(item => item.index)
            .DefaultIfEmpty(-1)
            .Max();
        return lastDigit >= 0 ? normalized[..(lastDigit + 1)] : normalized[..Math.Min(3, normalized.Length)];
    }

    private static DxccAlias CleanAliasPrefix(string value)
    {
        var exact = value.StartsWith("=", StringComparison.Ordinal);
        var prefix = exact ? value[1..] : value;
        prefix = Regex.Replace(prefix, @"\([^)]*\)|\[[^]]*\]|\{[^}]*\}|<[^>]*>|~[^~]*~", "");
        prefix = prefix.Trim().TrimStart('*').ToUpperInvariant();
        return new DxccAlias(prefix, exact);
    }

    private static int ParseInt(string value) =>
        int.TryParse(value.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var result) ? result : 0;

    private static double ParseDouble(string value) =>
        double.TryParse(value.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var result) ? result : 0;
}

public sealed record DxccLookupResult(
    string Country,
    int? Dxcc,
    string Continent,
    string PrimaryPrefix,
    string MatchedPrefix,
    string WpxPrefix,
    int CqZone,
    int ItuZone,
    double Latitude,
    double Longitude,
    double UtcOffset);

internal sealed record DxccEntry(
    string Name,
    int CqZone,
    int ItuZone,
    string Continent,
    double Latitude,
    double Longitude,
    double UtcOffset,
    string PrimaryPrefix,
    IReadOnlyList<DxccAlias> Aliases);

internal sealed record DxccAlias(string Prefix, bool Exact);

internal sealed record DxccEntryBuilder(
    string Name,
    int CqZone,
    int ItuZone,
    string Continent,
    double Latitude,
    double Longitude,
    double UtcOffset,
    string PrimaryPrefix)
{
    public List<DxccAlias> Aliases { get; } = new();

    public DxccEntry Build()
    {
        if (!Aliases.Any(alias => string.Equals(alias.Prefix, PrimaryPrefix, StringComparison.OrdinalIgnoreCase)))
            Aliases.Insert(0, new DxccAlias(PrimaryPrefix, Exact: false));

        return new DxccEntry(Name, CqZone, ItuZone, Continent, Latitude, Longitude, UtcOffset, PrimaryPrefix, Aliases);
    }
}
