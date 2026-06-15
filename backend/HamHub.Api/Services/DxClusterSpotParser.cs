using System.Globalization;
using System.Text.RegularExpressions;

namespace HamHub.Api.Services;

public sealed record DxClusterSpot(
    string Callsign,
    double FrequencyKhz,
    string Mode,
    string Spotter,
    string Info,
    string Time,
    string Source,
    DateTimeOffset RetrievedAt);

public static partial class DxClusterSpotParser
{
    public static DxClusterSpot? TryParse(string line, string source)
    {
        var match = DxSpotLineRegex().Match(line.Trim());
        if (!match.Success) return null;

        if (!double.TryParse(match.Groups["freq"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var frequencyKhz))
            return null;

        var info = Regex.Replace(match.Groups["info"].Value.Trim(), @"\s+", " ");

        return new DxClusterSpot(
            Callsign: match.Groups["call"].Value.ToUpperInvariant(),
            FrequencyKhz: frequencyKhz,
            Mode: InferMode(frequencyKhz, info),
            Spotter: match.Groups["spotter"].Value.ToUpperInvariant(),
            Info: info,
            Time: match.Groups["time"].Value.ToUpperInvariant(),
            Source: source,
            RetrievedAt: DateTimeOffset.UtcNow);
    }

    private static string InferMode(double frequencyKhz, string info)
    {
        var upper = info.ToUpperInvariant();
        foreach (var mode in new[] { "FT8", "FT4", "RTTY", "CW", "SSB", "USB", "LSB", "AM", "FM" })
        {
            if (upper.Contains(mode, StringComparison.Ordinal)) return mode;
        }

        return frequencyKhz switch
        {
            >= 5357 and <= 5358 => "FT8",
            >= 7074 and <= 7075 => "FT8",
            >= 14074 and <= 14075 => "FT8",
            >= 18100 and <= 18101 => "FT8",
            >= 21074 and <= 21075 => "FT8",
            >= 28074 and <= 28075 => "FT8",
            _ => "—"
        };
    }

    [GeneratedRegex(@"^DX\s+de\s+(?<spotter>[A-Z0-9\/-]+):\s+(?<freq>\d+(?:\.\d+)?)\s+(?<call>[A-Z0-9\/-]+)\s+(?<info>.*?)\s+(?<time>\d{4}Z)(?:\s|$)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex DxSpotLineRegex();
}
