namespace HamHub.Api.Services.Awards;

public static class AwardCatalog
{
    public static readonly IReadOnlyList<AwardDefinition> All = new[]
    {
        new AwardDefinition(
            Id: "dxcc",
            Sponsor: "ARRL",
            Name: "DXCC",
            Description: "DXCC entities worked and confirmed.",
            Status: "active",
            RuleType: "dxcc",
            Thresholds: new[] { 100 },
            DataRequirements: new[] { "Dxcc" },
            EntityUniverse: Enumerable.Range(1, 340).Select(item => item.ToString()).ToArray()),
        new AwardDefinition("dxcc-band", "ARRL", "DXCC by band", "DXCC entities per band.", "active", "dxcc-band", new[] { 100 }, new[] { "Dxcc", "Band" }),
        new AwardDefinition("dxcc-mode", "ARRL", "DXCC by mode", "DXCC entities per mode.", "active", "dxcc-mode", new[] { 100 }, new[] { "Dxcc", "Mode" }),
        new AwardDefinition("confirmed-dxcc", "HamHub", "Confirmed DXCC", "DXCC entities with QSL confirmation.", "active", "confirmed-dxcc", new[] { 100 }, new[] { "Dxcc", "QSL" }),
        new AwardDefinition(
            Id: "wac",
            Sponsor: "IARU",
            Name: "WAC",
            Description: "Worked all continents.",
            Status: "active",
            RuleType: "cont",
            Thresholds: new[] { 6 },
            DataRequirements: new[] { "Continent" },
            EntityUniverse: new[] { "AF", "AN", "AS", "EU", "NA", "OC", "SA" }),
        new AwardDefinition("wpx", "CQ", "WPX", "Worked prefixes.", "active", "px", new[] { 500, 1000, 1500, 2000 }, new[] { "WorkedCallsign" }),
        new AwardDefinition("grid", "HamHub", "Grids", "Worked Maidenhead grid squares.", "active", "grids", new[] { 100, 250, 500, 1000 }, new[] { "Locator" }),
        new AwardDefinition("waz", "CQ", "WAZ", "Worked all CQ zones.", "missing-data", "cqz", new[] { 40 }, new[] { "CqZone" }),
        new AwardDefinition("itu-zones", "IARU", "ITU Zones", "Worked ITU zones.", "missing-data", "ituz", new[] { 75 }, new[] { "ItuZone" }),
        new AwardDefinition("was", "ARRL", "WAS", "Worked all US states.", "missing-data", "states", new[] { 50 }, new[] { "State" }),
        new AwardDefinition("canada-provinces", "RAC", "Canadian provinces", "Worked Canadian provinces and territories.", "missing-data", "states", new[] { 13 }, new[] { "State" }),
        new AwardDefinition("counties", "CQ", "Counties", "Worked counties.", "coming-next", "cnty", new[] { 500, 1000, 2000, 3181 }, new[] { "County" }),
        new AwardDefinition("iota", "RSGB", "IOTA", "Islands on the Air references.", "coming-next", "iota", new[] { 100 }, new[] { "Iota" }),
        new AwardDefinition("pota", "POTA", "POTA", "Parks on the Air references.", "coming-next", "pota", new[] { 10, 50, 100 }, new[] { "PotaRefs" }),
        new AwardDefinition("sota", "SOTA", "SOTA", "Summits on the Air references.", "coming-next", "sota", new[] { 10, 50, 100 }, new[] { "SotaRefs" }),
    };

    public static AwardCatalogItemDto[] Items() => All
        .Select(definition => new AwardCatalogItemDto(
            definition.Id,
            definition.Sponsor,
            definition.Name,
            definition.Description,
            definition.Status,
            definition.RuleType,
            definition.Thresholds.FirstOrDefault(),
            definition.DataRequirements))
        .ToArray();
}
