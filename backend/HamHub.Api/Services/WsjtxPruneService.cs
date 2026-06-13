// HamHub.Api/Services/WsjtxPruneService.cs
using HamHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Services;

public class WsjtxPruneService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<WsjtxPruneService> _logger;

    public WsjtxPruneService(IServiceScopeFactory scopeFactory, ILogger<WsjtxPruneService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Prune on startup, then every hour
        await PruneAsync(stoppingToken);

        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
            await PruneAsync(stoppingToken);
    }

    private async Task PruneAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var cutoff = DateTime.UtcNow - TimeSpan.FromHours(4);
            var deleted = await db.WsjtxDecodes
                .Where(d => d.DecodedAt < cutoff)
                .ExecuteDeleteAsync(stoppingToken);
            if (deleted > 0)
                _logger.LogInformation("Pruned {Count} old WSJT-X decodes", deleted);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pruning WSJT-X decodes");
        }
    }
}
