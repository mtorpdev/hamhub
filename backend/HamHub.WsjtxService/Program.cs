using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using HamHub.WsjtxService;
using Microsoft.Extensions.Options;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(new ConfigurationBuilder()
        .AddJsonFile("appsettings.json", optional: false)
        .Build())
    .CreateLogger();

try
{
    var host = Host.CreateDefaultBuilder(args)
        .UseSerilog()
        .ConfigureServices((ctx, services) =>
        {
            services.Configure<HamHubConfig>(ctx.Configuration.GetSection("HamHub"));
            services.AddHttpClient();
            services.AddTransient<HamHubApiClient>(sp =>
            {
                var config = sp.GetRequiredService<IOptions<HamHubConfig>>().Value;
                var factory = sp.GetRequiredService<IHttpClientFactory>();
                var http = factory.CreateClient();
                var logger = sp.GetRequiredService<ILogger<HamHubApiClient>>();
                return new HamHubApiClient(http, config, logger);
            });
            services.AddHostedService<Worker>();
        })
        .Build();

    await host.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
