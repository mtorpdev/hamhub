using HamHub.Api.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class NoaaSwpcPropagationServiceTests
{
    [Fact]
    public void BuildPropagationUsesNearestKpScalesAndSolarWindSamples()
    {
        const string kpJson = """
        [
          {"time_tag":"2026-06-15T03:00:00","Kp":2.67,"a_running":12,"station_count":8},
          {"time_tag":"2026-06-15T06:00:00","Kp":5.33,"a_running":56,"station_count":8}
        ]
        """;
        const string scalesJson = """
        {
          "0": {
            "DateStamp": "2026-06-15",
            "TimeStamp": "06:00:00",
            "R": { "Scale": "1", "Text": "minor" },
            "S": { "Scale": "0", "Text": "none" },
            "G": { "Scale": "1", "Text": "minor" }
          }
        }
        """;
        const string plasmaJson = """
        [
          ["time_tag","density","speed","temperature"],
          ["2026-06-15 05:30:00.000","4.20","511.3","120000"],
          ["2026-06-15 05:31:00.000","5.10","520.7","130000"]
        ]
        """;
        const string magJson = """
        [
          ["time_tag","bx_gsm","by_gsm","bz_gsm","lon_gsm","lat_gsm","bt"],
          ["2026-06-15 05:30:00.000","-2.0","1.1","-4.4","120","10","6.8"]
        ]
        """;
        const string forecast45DayJson = """
        {
          "data": [
            {"time": "2026-06-15T00:00:00Z", "metric": "ap", "value": 8},
            {"time": "2026-06-15T00:00:00Z", "metric": "f107", "value": 120}
          ]
        }
        """;
        const string solarCycleJson = """
        [
          {"time-tag": "2025-06", "smoothed_ssn_min": 120.0, "smoothed_ssn_max": 130.0},
          {"time-tag": "2026-06", "smoothed_ssn_min": 50.0, "smoothed_ssn_max": 90.0},
          {"time-tag": "2026-07", "smoothed_ssn_min": 40.0, "smoothed_ssn_max": 80.0}
        ]
        """;
        const string xrayJson = """
        [
          {"time_tag": "2026-06-15T05:30:00Z", "flux": 0.0000021, "energy": "0.1-0.8nm"},
          {"time_tag": "2026-06-15T05:31:00Z", "flux": 0.000012, "energy": "0.1-0.8nm"}
        ]
        """;

        var propagation = NoaaSwpcPropagationService.BuildPropagation(
            new DateTime(2026, 6, 15, 5, 31, 0, DateTimeKind.Utc),
            kpJson,
            scalesJson,
            plasmaJson,
            magJson,
            forecast45DayJson,
            solarCycleJson,
            xrayJson);

        Assert.Equal("NOAA SWPC", propagation.Source);
        Assert.Equal(5.33, propagation.KpIndex);
        Assert.Equal("G1", propagation.GeomagneticScale);
        Assert.Equal("R1", propagation.RadioBlackoutScale);
        Assert.Equal("S0", propagation.SolarRadiationScale);
        Assert.Equal(520.7, propagation.SolarWindSpeedKms);
        Assert.Equal(5.1, propagation.SolarWindDensity);
        Assert.Equal(-4.4, propagation.InterplanetaryMagneticFieldBz);
        Assert.Equal(6.8, propagation.InterplanetaryMagneticFieldBt);
        Assert.Equal(120, propagation.SolarFluxIndex);
        Assert.Equal(70, propagation.SunspotNumber);
        Assert.Equal("Aftagende", propagation.SolarCyclePhase);
        Assert.Equal(56, propagation.SolarCycleProgressPercent);
        Assert.Equal("M1.2", propagation.XrayClass);
        Assert.Equal("D-RAP", propagation.DRegionAbsorption.Product);
        Assert.Equal("Mindre HF absorption mulig på solbelyst side", propagation.DRegionAbsorption.Impact);
        Assert.Contains("geomagnetisk storm", propagation.Description);
    }
}
