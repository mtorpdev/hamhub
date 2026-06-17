using System.Diagnostics;
using System.Threading.Channels;
using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxMac;

internal static class Program
{
    private const string HamHubAppUrl = "https://hamhub.dk";

    public static async Task<int> Main(string[] args)
    {
        if (args.Contains("--help", StringComparer.OrdinalIgnoreCase))
        {
            PrintHelp();
            return 0;
        }

        if (args.Contains("--open", StringComparer.OrdinalIgnoreCase))
        {
            OpenUrl(HamHubAppUrl);
            return 0;
        }

        var config = MacConfigStore.Load();
        if (args.Contains("--configure", StringComparer.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(config.Username) ||
            string.IsNullOrWhiteSpace(config.Password))
        {
            config = Configure(config);
            MacConfigStore.Save(config);
        }

        using var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder.SetMinimumLevel(LogLevel.Information);
            builder.AddSimpleConsole(options =>
            {
                options.SingleLine = true;
                options.TimestampFormat = "HH:mm:ss ";
            });
        });

        Console.WriteLine("HamHub WSJT-X Agent for macOS");
        Console.WriteLine($"Config: {MacConfigStore.PathForDisplay}");
        Console.WriteLine($"API:    {config.ServerUrl}");
        Console.WriteLine($"UDP:    {config.UdpPort}");
        Console.WriteLine("Tryk Ctrl+C for at stoppe.\n");

        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            cts.Cancel();
        };

        try
        {
            await RunAsync(config, loggerFactory, cts.Token);
            return 0;
        }
        catch (OperationCanceledException)
        {
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            return 1;
        }
    }

    private static HamHubConfig Configure(HamHubConfig current)
    {
        Console.WriteLine("HamHub WSJT-X Agent opsaetning");
        Console.WriteLine("Lad feltet vaere tomt for at beholde den viste vaerdi.\n");

        var serverUrl = Prompt("API adresse", current.ServerUrl);
        var username = Prompt("HamHub email", current.Username);
        var password = PromptPassword("HamHub password", string.IsNullOrWhiteSpace(current.Password));
        var udpPortText = Prompt("WSJT-X UDP port", current.UdpPort.ToString());
        var multicast = Prompt("WSJT-X multicast gruppe (valgfri)", current.UdpMulticast);

        return new HamHubConfig
        {
            ServerUrl = string.IsNullOrWhiteSpace(serverUrl) ? HamHubConfig.DefaultServerUrl : serverUrl.Trim().TrimEnd('/'),
            Username = username.Trim(),
            Password = string.IsNullOrEmpty(password) ? current.Password : password,
            UdpPort = int.TryParse(udpPortText, out var port) ? port : 2237,
            UdpMulticast = multicast.Trim()
        };
    }

    private static string Prompt(string label, string current)
    {
        var suffix = string.IsNullOrWhiteSpace(current) ? "" : $" [{current}]";
        Console.Write($"{label}{suffix}: ");
        var input = Console.ReadLine();
        return string.IsNullOrWhiteSpace(input) ? current : input;
    }

    private static string PromptPassword(string label, bool required)
    {
        Console.Write(required ? $"{label}: " : $"{label} [behold eksisterende]: ");
        var chars = new List<char>();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter)
            {
                Console.WriteLine();
                break;
            }
            if (key.Key == ConsoleKey.Backspace)
            {
                if (chars.Count == 0) continue;
                chars.RemoveAt(chars.Count - 1);
                Console.Write("\b \b");
                continue;
            }
            chars.Add(key.KeyChar);
            Console.Write("*");
        }

        return new string(chars.ToArray());
    }

    private static async Task RunAsync(
        HamHubConfig config,
        ILoggerFactory loggerFactory,
        CancellationToken ct)
    {
        using var httpClient = new HttpClient();
        var api = new HamHubApiClient(
            httpClient,
            config,
            loggerFactory.CreateLogger<HamHubApiClient>());

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await api.LoginAsync(ct);
                break;
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                loggerFactory.CreateLogger("HamHub.WsjtxMac")
                    .LogError(ex, "Login fejlede. Proever igen om 30 sekunder.");
                await Task.Delay(TimeSpan.FromSeconds(30), ct);
            }
        }

        var statusCache = new StatusCache();
        using var decodeBuffer = new DecodeBuffer(api, loggerFactory.CreateLogger<DecodeBuffer>());
        using var udpListener = new UdpListener(config, loggerFactory.CreateLogger<UdpListener>());
        var parser = new MessageParser(loggerFactory.CreateLogger<MessageParser>(), statusCache);
        var qsoChannel = Channel.CreateUnbounded<ParsedQsoLogged>(
            new UnboundedChannelOptions { SingleReader = true });

        await using var _ = ct.Register(() => qsoChannel.Writer.TryComplete());

        parser.DecodeReceived += (_, decode) =>
        {
            var status = statusCache.Get(decode.Id);
            var freqMhz = status.DialFreqHz > 0
                ? (status.DialFreqHz + decode.DeltaFreqHz) / 1_000_000.0
                : decode.DeltaFreqHz / 1_000_000.0;
            var (dxCall, dxGrid) = ParseDx(decode.Message);

            decodeBuffer.Enqueue(new WsjtxDecodeDto(
                WsjtxId: decode.Id,
                WsjtxTimeMs: decode.TimeMs,
                SpotterCallsign: status.DeCall,
                SpotterGrid: status.DeGrid,
                Message: decode.Message,
                DxCallsign: dxCall,
                DxGrid: dxGrid,
                Snr: decode.Snr,
                DeltaTime: decode.DeltaTime,
                DeltaFreqHz: (int)decode.DeltaFreqHz,
                FrequencyMhz: freqMhz,
                Mode: decode.Mode,
                LowConfidence: decode.LowConfidence,
                DecodedAt: DateTime.UtcNow));
        };

        parser.QsoLoggedReceived += (_, qso) => qsoChannel.Writer.TryWrite(qso);
        udpListener.MessageReceived += (_, data) => parser.Parse(data);

        decodeBuffer.Start(ct);
        udpListener.Start(ct);
        var drainTask = DrainQsoChannelAsync(qsoChannel, api, loggerFactory.CreateLogger("HamHub.Qso"), ct);

        await Task.Delay(Timeout.Infinite, ct).ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        await drainTask.WaitAsync(timeout.Token).ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
    }

    private static async Task DrainQsoChannelAsync(
        Channel<ParsedQsoLogged> channel,
        HamHubApiClient api,
        ILogger logger,
        CancellationToken ct)
    {
        await foreach (var qso in channel.Reader.ReadAllAsync(CancellationToken.None))
        {
            try
            {
                await api.PostQsoAsync(new WsjtxQsoDto(
                    DateUtc: qso.TimeOn,
                    OwnCallsign: qso.MyCall,
                    WorkedCallsign: qso.DxCall,
                    FrequencyMhz: qso.TxFreqHz / 1_000_000.0,
                    Mode: qso.Mode,
                    RstSent: qso.ReportSent,
                    RstReceived: qso.ReportReceived,
                    Locator: qso.DxGrid,
                    Notes: string.IsNullOrWhiteSpace(qso.Comments) ? null : qso.Comments), ct);
                logger.LogInformation("Auto-loggede QSO med {DxCall}", qso.DxCall);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Kunne ikke logge QSO med {DxCall}", qso.DxCall);
            }
        }
    }

    private static (string? dxCall, string? dxGrid) ParseDx(string message)
    {
        var parts = message.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2) return (null, null);
        if (!parts[0].Equals("CQ", StringComparison.OrdinalIgnoreCase))
            return (parts[1], null);

        var grid = parts.Length >= 3 && (parts[2].Length == 4 || parts[2].Length == 6)
            ? parts[2]
            : null;
        return (parts[1], grid);
    }

    private static void OpenUrl(string url)
    {
        Process.Start(new ProcessStartInfo("open", url) { UseShellExecute = false });
    }

    private static void PrintHelp()
    {
        Console.WriteLine("""
        HamHub WSJT-X Agent for macOS

        Brug:
          HamHub.WsjtxMac              Konfigurerer ved behov og starter agenten
          HamHub.WsjtxMac --configure  Aendrer login/API/UDP config
          HamHub.WsjtxMac --open       Aabner HamHub i browseren

        Config gemmes i:
          ~/Library/Application Support/HamHub/wsjtx-agent.json
        """);
    }
}
