using HamHub.Api.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class Kc2gMufFof2ServiceTests
{
    [Fact]
    public void BuildSnapshotUsesNearestStationsForOwnWorkedAndMidpoint()
    {
        const string stationsJson = """
        [
          {
            "fof2": 7.2,
            "mufd": 21.6,
            "cs": 93.0,
            "time": "2026-06-15T13:15:00",
            "source": "giro",
            "station": { "name": "Juliusruh, Germany", "latitude": "54.6", "longitude": "13.4" }
          },
          {
            "fof2": 5.8,
            "mufd": 17.4,
            "cs": 88.0,
            "time": "2026-06-15T13:10:00",
            "source": "giro",
            "station": { "name": "Dourbes, Belgium", "latitude": "50.1", "longitude": "4.6" }
          },
          {
            "fof2": 9.1,
            "mufd": 27.3,
            "cs": 97.0,
            "time": "2026-06-15T13:12:00",
            "source": "giro",
            "station": { "name": "Austin, TX, USA", "latitude": "30.4", "longitude": "262.3" }
          }
        ]
        """;

        var snapshot = Kc2gMufFof2Service.BuildSnapshot(
            stationsJson,
            new QsoLocationConditionsDto("OZ4MT", "Min station", "JO65", 55.5, 13.0, null),
            new QsoLocationConditionsDto("ON1ABC", "Kontakt", "JO20", 50.5, 5.0, null));

        Assert.Equal("KC2G MUF/foF2 nowcast", snapshot.Source);
        Assert.Equal("Live nowcast", snapshot.Status);
        Assert.Equal("Juliusruh, Germany", snapshot.OwnNearestStation!.Name);
        Assert.Equal(7.2, snapshot.OwnNearestStation.Fof2Mhz);
        Assert.Equal(21.6, snapshot.OwnNearestStation.Muf3000Mhz);
        Assert.Equal("Dourbes, Belgium", snapshot.WorkedNearestStation!.Name);
        Assert.Equal("Juliusruh, Germany", snapshot.MidpointNearestStation!.Name);
        Assert.Contains(snapshot.BandRecommendations, band => band.Band == "20m" && band.Supported);
        Assert.Contains(snapshot.BandRecommendations, band => band.Band == "10m" && !band.Supported);
    }
}
