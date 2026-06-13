namespace HamHub.Application.Admin.DTOs;

public record DashboardStatsDto(
    int TotalUsers,
    int TotalStations,
    int TotalQsos,
    int TotalDxSpots,
    int TotalArticles
);
