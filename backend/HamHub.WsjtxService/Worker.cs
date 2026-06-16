using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Options;
using System.Threading.Channels;

namespace HamHub.WsjtxService;

public class Worker : BackgroundService
{
    private readonly HamHubConfig _config;
    private readonly HamHubApiClient _api;
    private readonly ILogger<Worker> _logger;
    private readonly ILogger<DecodeBuffer> _decodeBufferLogger;
    private readonly ILogger<UdpListener> _udpListenerLogger;
    private readonly ILogger<MessageParser> _parserLogger;
    private readonly WsjtxCommandSender _commandSender;
    private readonly WsjtxUiController _uiController;

    public Worker(
        IOptions<HamHubConfig> config,
        HamHubApiClient api,
        ILogger<Worker> logger,
        ILogger<DecodeBuffer> decodeBufferLogger,
        ILogger<UdpListener> udpListenerLogger,
        ILogger<MessageParser> parserLogger,
        WsjtxCommandSender commandSender,
        WsjtxUiController uiController)
    {
        _config = config.Value;
        _api = api;
        _logger = logger;
        _decodeBufferLogger = decodeBufferLogger;
        _udpListenerLogger = udpListenerLogger;
        _parserLogger = parserLogger;
        _commandSender = commandSender;
        _uiController = uiController;
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
                DecodedAt: DateTime.UtcNow
            ));
        };

        var qsoChannel = Channel.CreateUnbounded<ParsedQsoLogged>(
            new UnboundedChannelOptions { SingleReader = true });
        var statusChannel = Channel.CreateUnbounded<WsjtxStatusDto>(
            new UnboundedChannelOptions { SingleReader = true });

        await using var qsoRegistration = stoppingToken.Register(() => qsoChannel.Writer.TryComplete());
        await using var statusRegistration = stoppingToken.Register(() => statusChannel.Writer.TryComplete());

        parser.QsoLoggedReceived += (_, qso) =>
        {
            qsoChannel.Writer.TryWrite(qso);
        };

        parser.StatusReceived += (_, status) =>
        {
            statusChannel.Writer.TryWrite(new WsjtxStatusDto(
                WsjtxId: status.Id,
                DxCall: status.Entry.DxCall,
                DxGrid: status.Entry.DxGrid,
                Mode: status.Entry.Mode,
                TxEnabled: status.Entry.TxEnabled,
                Transmitting: status.Entry.Transmitting,
                Decoding: status.Entry.Decoding,
                TxWatchdog: status.Entry.TxWatchdog,
                RxDf: status.Entry.RxDf,
                TxDf: status.Entry.TxDf,
                UpdatedAtUtc: DateTime.UtcNow));
        };

        udpListener.DatagramReceived += (_, datagram) =>
        {
            _commandSender.SetTarget(datagram.RemoteEndPoint);
            parser.Parse(datagram.Data);
        };

        decodeBuffer.Start(stoppingToken);
        udpListener.Start(stoppingToken);
        var drainTask = DrainQsoChannelAsync(qsoChannel, stoppingToken);
        var statusTask = DrainStatusChannelAsync(statusChannel, stoppingToken);
        var commandTask = PollCommandsAsync(statusCache, stoppingToken);

        _logger.LogInformation("WSJT-X agent running. Press Ctrl+C to stop.");
        await Task.Delay(Timeout.Infinite, stoppingToken).ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);

        // stoppingToken fired → writer was completed via Register → ReadAllAsync finishes draining remaining items
        using var drainTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        await drainTask.WaitAsync(drainTimeout.Token)
                       .ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
        await statusTask.WaitAsync(drainTimeout.Token)
                       .ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
        await commandTask.WaitAsync(drainTimeout.Token)
                         .ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
    }

    private async Task PollCommandsAsync(StatusCache statusCache, CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (!ct.IsCancellationRequested && await timer.WaitForNextTickAsync(ct))
        {
            WsjtxAgentCommand? command;
            try
            {
                command = await _api.GetNextCommandAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Command poll failed, retrying on next tick");
                continue;
            }
            if (command is null) continue;

            var success = false;
            var message = string.Empty;
            try
            {
                switch (command.Type)
                {
                    case WsjtxCommandType.Reply when command.Reply is not null:
                        await _commandSender.SendReplyAsync(command.Reply, ct);
                        await _uiController.StartCallingAsync(ct);
                        await Task.Delay(TimeSpan.FromMilliseconds(500), ct);
                        var status = statusCache.Get(command.Reply.WsjtxId);
                        _logger.LogInformation(
                            "WSJT-X status after Reply: DxCall={DxCall} DxGrid={DxGrid} TxEnabled={TxEnabled} Transmitting={Transmitting} Decoding={Decoding} TxWatchdog={TxWatchdog} RxDf={RxDf} TxDf={TxDf}",
                            status.DxCall,
                            status.DxGrid,
                            status.TxEnabled,
                            status.Transmitting,
                            status.Decoding,
                            status.TxWatchdog,
                            status.RxDf,
                            status.TxDf);
                        success = true;
                        message = "Reply sendt og kald aktiveret i WSJT-X.";
                        break;
                    case WsjtxCommandType.StopTx:
                        await _uiController.StopTxAsync(ct);
                        success = true;
                        message = "Stop Tx sendt til WSJT-X.";
                        break;
                    default:
                        message = "Ukendt WSJT-X kommando.";
                        break;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Failed to execute WSJT-X command {CommandId}", command.Id);
                message = ex.Message;
            }

            await _api.CompleteCommandAsync(command.Id, command.Type, success, message, ct);
        }
    }

    private async Task DrainQsoChannelAsync(
        Channel<ParsedQsoLogged> channel, CancellationToken ct)
    {
        // ReadAllAsync with CancellationToken.None — exits when writer is completed (not when ct fires)
        await foreach (var qso in channel.Reader.ReadAllAsync(CancellationToken.None))
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
                ), ct);
                _logger.LogInformation("Auto-logged QSO with {DxCall}", qso.DxCall);
            }
            catch (OperationCanceledException)
            {
                // ct fired (shutdown) — stop making HTTP calls; remaining items in channel are lost but that's acceptable
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log QSO with {DxCall}", qso.DxCall);
            }
        }
    }

    private async Task DrainStatusChannelAsync(
        Channel<WsjtxStatusDto> channel, CancellationToken ct)
    {
        await foreach (var status in channel.Reader.ReadAllAsync(CancellationToken.None))
        {
            try
            {
                await _api.PostStatusAsync(status, ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to post WSJT-X status for {WsjtxId}", status.WsjtxId);
            }
        }
    }
}
