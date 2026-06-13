using System.Windows;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;

namespace HamHub.WsjtxTray;

public partial class App : Application
{
    private IHost? _host;
    private TrayOrchestrator? _tray;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        Log.Logger = new LoggerConfiguration()
            .WriteTo.Console()
            .WriteTo.File("logs/wsjtx-tray-.log", rollingInterval: Serilog.RollingInterval.Day)
            .CreateLogger();

        _host = Host.CreateDefaultBuilder()
            .UseSerilog()
            .ConfigureServices((ctx, services) =>
            {
                services.Configure<HamHubConfig>(ctx.Configuration.GetSection("HamHub"));
            })
            .Build();

        _tray = new TrayOrchestrator();
        _tray.ExitRequested += (_, _) => Shutdown();
        _tray.Initialize();

        await _host.StartAsync();
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        _tray?.Dispose();
        if (_host != null)
        {
            await _host.StopAsync();
            _host.Dispose();
        }
        Log.CloseAndFlush();
        base.OnExit(e);
    }
}
