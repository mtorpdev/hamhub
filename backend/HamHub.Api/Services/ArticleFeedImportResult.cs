namespace HamHub.Api.Services;

public record ArticleFeedImportResult(
    int Imported,
    int Skipped,
    int FailedFeeds,
    DateTime ImportedAtUtc
);
