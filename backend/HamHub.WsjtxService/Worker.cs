using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Options;

namespace HamHub.WsjtxService;

public class Worker : BackgroundService
{
    private readonly HamHubConfig _config;
    private readonly HamHubApiClient _api;
    private readonly ILogger<Worker> _logger;
    private readonly ILogger<DecodeBuffer> _decodeBufferLogger;
    private readonly ILogger<UdpListener> _udpListenerLogger;
    private readonly ILogger<MessageParser> _parserLogger;

    public Worker(
        IOptions<HamHubConfig> config,
        HamHubApiClient api,
        ILogger<Worker> logger,
        ILogger<DecodeBuffer> decodeBufferLogger,
        ILogger<UdpListener> udpListenerLogger,
        ILogger<MessageParser> parserLogger)
    {
        _config = config.Value;
        _api = api;
        _logger = logger;
        _decodeBufferLogger = decodeBufferLogger;
        _udpListenerLogger = udpListenerLogger;
        _parserLogger = parserLogger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Step 1: Validate config
        if (string.IsNullOrWhiteSpace(_config.ServerUrl) ||
            string.IsNullOrWhiteSpace(_config.Username) ||
            string.IsNullOrWhiteSpace(_config.Password))
        {
            _logger.LogError("Missing required config: ServerUrl, Username, or Password. Exiting.");
            return;
        }

        // Step 2: Login with retry
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _api.LoginAsync(stoppingToken);
                break;
            }
            catch (OperationCanceledException) { return; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login failed, retrying in 30s...");
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        if (stoppingToken.IsCancellationRequested) return;

        // Step 3: Start UDP listener and decode buffer
        var statusCache = new StatusCache();
        using var decodeBuffer = new DecodeBuffer(_api, _decodeBufferLogger);
        using var udpListener = new UdpListener(_config, _udpListenerLogger);
        var parser = new MessageParser(_parserLogger, statusCache);

        parser.DecodeReceived += (_, decode) =>
        {
            var status = statusCache.Get(decode.Id);
            var freqMhz = status.DialFreqHz > 0
                ? (status.DialFreqHz + decode.DeltaFreqHz) / 1_000_000.0
                : decode.DeltaFreqHz / 1_000_000.0;

            // Parse DX callsign/grid from FT8 message (simple pattern: "CQ CALLSIGN GRID" or "CALLSIGN CALLSIGN REPORT")
            string? dxCall = null, dxGrid = null;
            var parts = decode.Message.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 2)
            {
                if (parts[0].Equals("CQ", StringComparison.OrdinalIgnoreCase) && parts.Length >= 3)
                {
                    dxCall = parts[1];
                    if (parts[2].Length == 4 || parts[2].Length == 6) dxGrid = parts[2];
                }
                else
                {
                    dxCall = parts[1];
                }
            }

            decodeBuffer.Enqueue(new WsjtxDecodeDto(
                SpotterCallsign: status.DeCall,
                Message: decode.Message,
                DxCallsign: dxCall,
                DxGrid: dxGrid,
                Snr: decode.Snr,
                DeltaTime: decode.DeltaTime,
                DeltaFreqHz: decode.DeltaFreqHz,
                FrequencyMhz: freqMhz,
                Mode: decode.Mode,
                DecodedAt: DateTime.UtcNow
            ));
        };

        parser.QsoLoggedReceived += async (_, qso) =>
        {
            try
            {
                await _api.PostQsoAsync(new WsjtxQsoDto(
                    DateUtc: qso.TimeOn,
                    OwnCallsign: qso.MyCall,
                    WorkedCallsign: qso.DxCall,
                    FrequencyMhz: qso.TxFreqHz / 1_000_000.0,
                    Mode: qso.Mode,
                    RstSent: qso.ReportSent,
                    RstReceived: qso.ReportReceived,
                    Locator: qso.DxGrid,
                    Notes: string.IsNullOrWhiteSpace(qso.Comments) ? null : qso.Comments
                ), stoppingToken);
                _logger.LogInformation("Auto-logged QSO with {DxCall}", qso.DxCall);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log QSO with {DxCall}", qso.DxCall);
            }
        };

        udpListener.MessageReceived += (_, data) => parser.Parse(data);

        decodeBuffer.Start(stoppingToken);
        udpListener.Start(stoppingToken);

        _logger.LogInformation("WSJT-X agent running. Press Ctrl+C to stop.");
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }
}
