using HamHub.Domain.Entities;

namespace HamHub.Api.Services;

public static class QsoAnalysisStoryBuilder
{
    public static string Build(
        QsoEntry qso,
        QsoAnalysisScoresDto scores,
        QsoAnalysisAwardImpactDto awards,
        QsoAnalysisPropagationDto propagation)
    {
        var parts = new List<string>
        {
            $"This {qso.Mode} QSO with {qso.WorkedCallsign} on {BandLabel(qso.Band)} was logged at {qso.DateUtc.ToUniversalTime():yyyy-MM-dd HH:mm} UTC."
        };

        if (qso.LotwConfirmedAt.HasValue)
        {
            parts.Add("It is confirmed on LoTW.");
        }
        else if (qso.EqslConfirmedAt.HasValue)
        {
            parts.Add("It is confirmed on eQSL.");
        }
        else if (qso.QrzConfirmedAt.HasValue || string.Equals(qso.QrzConfirmationStatus, "C", StringComparison.OrdinalIgnoreCase))
        {
            parts.Add("It is confirmed on QRZ.");
        }
        else if (scores.Confirmation >= 50)
        {
            parts.Add("It has external log activity, but no full confirmation yet.");
        }
        else
        {
            parts.Add("It has not been confirmed by an external log source yet.");
        }

        if (awards.ContributesTo.Length > 0)
        {
            parts.Add($"It contributes to {string.Join(", ", awards.ContributesTo)} tracking.");
        }

        if (propagation.DistanceKm.HasValue)
        {
            parts.Add($"The path is approximately {Math.Round(propagation.DistanceKm.Value)} km.");
        }

        if (awards.BlockedByMissingFields.Length > 0)
        {
            parts.Add($"Some analysis is limited by missing {string.Join(", ", awards.BlockedByMissingFields)}.");
        }

        return string.Join(" ", parts);
    }

    private static string BandLabel(HamHub.Domain.Enums.Band band) => band switch
    {
        HamHub.Domain.Enums.Band.M160 => "160m",
        HamHub.Domain.Enums.Band.M80 => "80m",
        HamHub.Domain.Enums.Band.M60 => "60m",
        HamHub.Domain.Enums.Band.M40 => "40m",
        HamHub.Domain.Enums.Band.M30 => "30m",
        HamHub.Domain.Enums.Band.M20 => "20m",
        HamHub.Domain.Enums.Band.M17 => "17m",
        HamHub.Domain.Enums.Band.M15 => "15m",
        HamHub.Domain.Enums.Band.M12 => "12m",
        HamHub.Domain.Enums.Band.M10 => "10m",
        HamHub.Domain.Enums.Band.M6 => "6m",
        HamHub.Domain.Enums.Band.M2 => "2m",
        HamHub.Domain.Enums.Band.CM70 => "70cm",
        _ => band.ToString()
    };
}
