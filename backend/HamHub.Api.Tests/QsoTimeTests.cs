using HamHub.Api.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class QsoTimeTests
{
    [Fact]
    public void NormalizeUtcTreatsUnspecifiedDateTimeAsUtc()
    {
        var value = new DateTime(2026, 6, 20, 12, 34, 0, DateTimeKind.Unspecified);

        var normalized = QsoTime.NormalizeUtc(value);

        Assert.Equal(DateTimeKind.Utc, normalized.Kind);
        Assert.Equal(new DateTime(2026, 6, 20, 12, 34, 0, DateTimeKind.Utc), normalized);
    }

    [Fact]
    public void NormalizeUtcConvertsLocalDateTimeToUtc()
    {
        var value = new DateTime(2026, 6, 20, 12, 34, 0, DateTimeKind.Local);

        var normalized = QsoTime.NormalizeUtc(value);

        Assert.Equal(DateTimeKind.Utc, normalized.Kind);
        Assert.Equal(value.ToUniversalTime(), normalized);
    }
}
