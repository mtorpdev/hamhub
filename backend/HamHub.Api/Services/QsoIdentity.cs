using HamHub.Domain.Entities;
using HamHub.Domain.Enums;

namespace HamHub.Api.Services;

public static class QsoIdentity
{
    public static Band? InferBandFromFrequency(double? frequencyMhz)
    {
        if (!frequencyMhz.HasValue) return null;
        var f = frequencyMhz.Value;
        return f switch
        {
            >= 1.8 and <= 2.0 => Band.M160,
            >= 3.5 and <= 4.0 => Band.M80,
            >= 5.0 and <= 5.5 => Band.M60,
            >= 7.0 and <= 7.3 => Band.M40,
            >= 10.1 and <= 10.15 => Band.M30,
            >= 14.0 and <= 14.35 => Band.M20,
            >= 18.068 and <= 18.168 => Band.M17,
            >= 21.0 and <= 21.45 => Band.M15,
            >= 24.89 and <= 24.99 => Band.M12,
            >= 28.0 and <= 29.7 => Band.M10,
            >= 50.0 and <= 54.0 => Band.M6,
            >= 144.0 and <= 148.0 => Band.M2,
            >= 420.0 and <= 450.0 => Band.CM70,
            _ => null
        };
    }

    public static bool IsDuplicateCandidate(
        QsoEntry existing,
        string userId,
        string ownCallsign,
        string workedCallsign,
        DateTime dateUtc,
        Band band,
        Mode mode,
        TimeSpan tolerance)
    {
        if (existing.UserId != userId) return false;
        if (!SameCallsign(existing.WorkedCallsign, workedCallsign)) return false;
        if (!string.IsNullOrWhiteSpace(ownCallsign) &&
            !string.IsNullOrWhiteSpace(existing.OwnCallsign) &&
            !SameCallsign(existing.OwnCallsign, ownCallsign)) return false;
        if (existing.Mode != mode) return false;
        if (!BandsMatch(existing.Band, band)) return false;

        return (existing.DateUtc - dateUtc).Duration() <= tolerance;
    }

    public static bool BandsMatch(Band existing, Band incoming)
    {
        if (!Enum.IsDefined(existing) || (int)existing == 0) return true;
        if (!Enum.IsDefined(incoming) || (int)incoming == 0) return true;
        return existing == incoming;
    }

    private static bool SameCallsign(string left, string right) =>
        string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);
}
