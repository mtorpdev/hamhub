using HamHub.Api.Services;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using Xunit;

namespace HamHub.Api.Tests;

public class QsoIdentityTests
{
    [Theory]
    [InlineData(14.075562, Band.M20)]
    [InlineData(7.074, Band.M40)]
    [InlineData(50.313, Band.M6)]
    public void InferBandFromFrequencyMapsHamBands(double frequencyMhz, Band expected)
    {
        Assert.Equal(expected, QsoIdentity.InferBandFromFrequency(frequencyMhz));
    }

    [Fact]
    public void IsDuplicateCandidateTreatsUnknownLocalBandAsMatchWhenOtherIdentityFieldsMatch()
    {
        var existing = new QsoEntry
        {
            UserId = "user-1",
            OwnCallsign = "OZ4MT",
            WorkedCallsign = "SP6SOZ",
            DateUtc = new DateTime(2026, 6, 17, 9, 35, 0, DateTimeKind.Utc),
            Band = 0,
            Mode = Mode.FT8,
            Frequency = 14.075562
        };

        Assert.True(QsoIdentity.IsDuplicateCandidate(
            existing,
            userId: "user-1",
            ownCallsign: "OZ4MT",
            workedCallsign: "SP6SOZ",
            dateUtc: new DateTime(2026, 6, 17, 9, 35, 20, DateTimeKind.Utc),
            band: Band.M20,
            mode: Mode.FT8,
            tolerance: TimeSpan.FromSeconds(60)));
    }

    [Fact]
    public void IsDuplicateCandidateRejectsDifferentCallsigns()
    {
        var existing = new QsoEntry
        {
            UserId = "user-1",
            OwnCallsign = "OZ4MT",
            WorkedCallsign = "SP6SOZ",
            DateUtc = new DateTime(2026, 6, 17, 9, 35, 0, DateTimeKind.Utc),
            Band = Band.M20,
            Mode = Mode.FT8
        };

        Assert.False(QsoIdentity.IsDuplicateCandidate(
            existing,
            userId: "user-1",
            ownCallsign: "OZ4MT",
            workedCallsign: "DL1ABC",
            dateUtc: new DateTime(2026, 6, 17, 9, 35, 0, DateTimeKind.Utc),
            band: Band.M20,
            mode: Mode.FT8,
            tolerance: TimeSpan.FromSeconds(60)));
    }
}
