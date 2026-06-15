namespace HamHub.Api.Services;

public class ArticleFeedImportHostedService : BackgroundService
{
    private static readonly TimeOnly DailyImportTime = new(6, 0);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ArticleFeedImportHostedService> _logger;
    private readonly TimeZoneInfo _timeZone;

    public ArticleFeedImportHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<ArticleFeedImportHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _timeZone = ResolveTimeZone();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = GetDelayUntilNextRun();
            _logger.LogInformation(
                "Next article feed import scheduled in {Delay} at {LocalTime}",
                delay,
                TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow.Add(delay), _timeZone));

            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var importer = scope.ServiceProvider.GetRequiredService<ArticleFeedImportService>();
                var result = await importer.ImportAsync(stoppingToken);
                _logger.LogInformation(
                    "Daily article feed import completed. Imported={Imported}, Skipped={Skipped}, FailedFeeds={FailedFeeds}",
                    result.Imported,
                    result.Skipped,
                    result.FailedFeeds);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Daily article feed import failed");
            }
        }
    }

    private TimeSpan GetDelayUntilNextRun()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, _timeZone);
        var next = new DateTimeOffset(now.Date + DailyImportTime.ToTimeSpan(), now.Offset);
        if (next <= now)
        {
            next = next.AddDays(1);
        }

        return next.ToUniversalTime() - DateTimeOffset.UtcNow;
    }

    private static TimeZoneInfo ResolveTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Europe/Copenhagen");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }
}
