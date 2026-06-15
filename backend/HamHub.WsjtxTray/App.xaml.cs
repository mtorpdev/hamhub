using System.Windows;
using System.IO;
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

        var logDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "HamHub",
            "logs");
        Directory.CreateDirectory(logDir);

        Log.Logger = new LoggerConfiguration()
            .WriteTo.Console()
            .WriteTo.File(Path.Combine(logDir, "wsjtx-tray-.log"), rollingInterval: Serilog.RollingInterval.Day)
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

        try { await _host.StartAsync(); }
        catch (Exception ex) { Log.Fatal(ex, "Host failed to start"); Shutdown(); }
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        _tray?.Dispose();
        if (_host != null)
        {
            try
            {
                await _host.StopAsync(TimeSpan.FromSeconds(5));
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error stopping host");
            }
            finally
            {
                _host.Dispose();
            }
        }
        Log.CloseAndFlush();
        base.OnExit(e);
    }
}
