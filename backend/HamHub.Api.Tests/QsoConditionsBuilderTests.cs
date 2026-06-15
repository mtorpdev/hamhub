using HamHub.Api.Services;
using HamHub.Domain.Entities;
using Xunit;

namespace HamHub.Api.Tests;

public class QsoConditionsBuilderTests
{
    [Fact]
    public void BuildFromQsoConvertsGridLocatorsAndCalculatesPath()
    {
        var qso = new QsoEntry
        {
            DateUtc = new DateTime(2026, 6, 15, 12, 34, 0, DateTimeKind.Utc),
            OwnCallsign = "OZ4MT",
            WorkedCallsign = "DL1ABC",
            MyGridsquare = "JO65",
            Locator = "JO62"
        };

        var conditions = QsoConditionsBuilder.Build(qso);

        Assert.NotNull(conditions.OwnLocation);
        Assert.Equal("OZ4MT", conditions.OwnLocation!.Callsign);
        Assert.Equal("JO65", conditions.OwnLocation.Grid);
        Assert.InRange(conditions.OwnLocation.Latitude, 55.4, 55.6);
        Assert.InRange(conditions.OwnLocation.Longitude, 12.9, 13.1);

        Assert.NotNull(conditions.WorkedLocation);
        Assert.Equal("DL1ABC", conditions.WorkedLocation!.Callsign);
        Assert.Equal("JO62", conditions.WorkedLocation.Grid);
        Assert.InRange(conditions.DistanceKm!.Value, 330, 430);
        Assert.InRange(conditions.BearingDegrees!.Value, 175, 205);
        Assert.Equal(new DateTime(2026, 6, 15, 13, 0, 0, DateTimeKind.Utc), conditions.NearestWeatherHourUtc);
        Assert.NotNull(conditions.Propagation.Path);
        Assert.Equal("Dagslys", conditions.Propagation.Path!.OwnLight);
        Assert.Equal("Dagslys", conditions.Propagation.Path.WorkedLight);
        Assert.Equal("Dagslysrute", conditions.Propagation.Path.Summary);
        Assert.Contains(conditions.Propagation.BandConditions, band => band.Band == "20m" && band.Rating == "God");
        Assert.Contains(conditions.Propagation.BandConditions, band => band.Band == "80m" && band.Rating == "Svag");
    }
}
