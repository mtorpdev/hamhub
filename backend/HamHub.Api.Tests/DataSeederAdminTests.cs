using HamHub.Infrastructure.Persistence.Seeders;
using Xunit;

namespace HamHub.Api.Tests;

public class DataSeederAdminTests
{
    [Fact]
    public void PrimaryAdminIsOz4mt()
    {
        Assert.Equal("micael.torp@gmail.com", DataSeeder.PrimaryAdminEmail);
        Assert.Equal("OZ4MT", DataSeeder.PrimaryAdminCallsign);
    }
}
