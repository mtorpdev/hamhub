using System.Diagnostics;
using System.Drawing;
using System.Net.Http;
using System.Threading.Channels;
using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;
using Serilog;
using Forms = System.Windows.Forms;
using WpfApplication = System.Windows.Application;

namespace HamHub.WsjtxTray;

public enum ConnectionState { Disconnected, Connected, Error }

public class TrayOrchestrator : IDisposable
{
    private Forms.NotifyIcon? _trayIcon;
    private HamHubConfig _config = new();
    private HamHubApiClient? _apiClient;
    private HttpClient? _httpClient;
    private UdpListener? _udpListener;
    private DecodeBuffer? _decodeBuffer;
    private MessageParser? _parser;
    private StatusCache? _statusCache;
    private WsjtxCommandSender? _commandSender;
    private readonly LogBuffer _logBuffer = new();
    private CancellationTokenSource _cts = new();
    private ConnectionState _state = ConnectionState.Disconnected;
    private Task _runTask = Task.CompletedTask;

    public event EventHandler? ExitRequested;

    public void Initialize()
    {
        _config = ConfigStore.Load();
        _trayIcon = new Forms.NotifyIcon { Visible = true };
        UpdateIcon(ConnectionState.Disconnected);
        BuildContextMenu();
        _runTask = StartAsync(_cts.Token);
        _ = _runTask.ContinueWith(t =>
        {
            var ex = t.Exception?.GetBaseException();
            if (ex != null)
            {
                _logBuffer.Add($"[ERROR] Agent stopped: {ex.Message}");
                Log.Error(ex, "Tray agent stopped unexpectedly");
            }
        }, TaskContinuationOptions.OnlyOnFaulted);
    }

    private void BuildContextMenu()
    {
        if (_trayIcon == null) return;
        var menu = new Forms.ContextMenuStrip();

        menu.Items.Add(new Forms.ToolStripMenuItem(GetStatusText()) { Enabled = false });
        menu.Items.Add(new Forms.ToolStripSeparator());

        var openItem = new Forms.ToolStripMenuItem("Aabn HamHub");
        openItem.Click += (_, _) =>
            Process.Start(new ProcessStartInfo("https://hamhub.dk") { UseShellExecute = true });
        menu.Items.Add(openItem);

        var settingsItem = new Forms.ToolStripMenuItem("Indstillinger");
        settingsItem.Click += (_, _) =>
        {
            WpfApplication.Current.Dispatcher.Invoke(() =>
            {
                var win = new SettingsWindow(_config);
                if (win.ShowDialog() == true)
                {
                    _config = win.Config;
                    ConfigStore.Save(_config);
                    _ = RestartAsync().ContinueWith(t =>
                    {
                        if (t.IsFaulted && t.Exception != null)
                            _logBuffer.Add($"[ERROR] Restart failed: {t.Exception.GetBaseException().Message}");
                    }, TaskContinuationOptions.OnlyOnFaulted);
                }
            });
        };
        menu.Items.Add(settingsItem);

        var logItem = new Forms.ToolStripMenuItem("Se log");
        logItem.Click += (_, _) =>
            WpfApplication.Current.Dispatcher.Invoke(() => new LogWindow(_logBuffer).Show());
        menu.Items.Add(logItem);

        menu.Items.Add(new Forms.ToolStripSeparator());
        var exitItem = new Forms.ToolStripMenuItem("Afslut");
        exitItem.Click += (_, _) => ExitRequested?.Invoke(this, EventArgs.Empty);
        menu.Items.Add(exitItem);

        _trayIcon.ContextMenuStrip = menu;
    }

    private string GetStatusText() => _state switch
    {
        ConnectionState.Connected => $"Tilsluttet som {_config.Username}",
        ConnectionState.Error => "Fejl - se log",
        _ => "Ikke tilsluttet"
    };

    private void UpdateIcon(ConnectionState state)
    {
        if (!WpfApplication.Current.Dispatcher.CheckAccess())
        {
            WpfApplication.Current.Dispatcher.Invoke(() => UpdateIcon(state));
            return;
        }

        _state = state;
        if (_trayIcon == null) return;
        _trayIcon.Icon = state switch
        {
            ConnectionState.Connected => SystemIcons.Information,
            ConnectionState.Error => SystemIcons.Error,
            _ => SystemIcons.Application
        };
        _trayIcon.Text = GetStatusText()[..Math.Min(GetStatusText().Length, 63)];
        BuildContextMenu();
    }

    private async Task StartAsync(CancellationToken ct)
    {
        using var loggerFactory = LoggerFactory.Create(b => b.AddConsole().AddSerilog());

        _httpClient = new HttpClient();
        _apiClient = null;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                _apiClient = new HamHubApiClient(_httpClient, _config,
                    loggerFactory.CreateLogger<HamHubApiClient>());
                await _apiClient.LoginAsync(ct);
                WpfApplication.Current.Dispatcher.Invoke(() => UpdateIcon(ConnectionState.Connected));
                break;
            }
            catch (OperationCanceledException) { return; }
            catch (Exception ex)
            {
                _logBuffer.Add($"[ERROR] Login failed: {ex.Message}");
                WpfApplication.Current.Dispatcher.Invoke(() => UpdateIcon(ConnectionState.Error));
                try { await Task.Delay(TimeSpan.FromSeconds(30), ct); }
                catch (OperationCanceledException) { return; }
            }
        }

        if (ct.IsCancellationRequested || _apiClient == null) return;

        _statusCache = new StatusCache();
        _decodeBuffer = new DecodeBuffer(_apiClient,
            loggerFactory.CreateLogger<DecodeBuffer>());
        _udpListener = new UdpListener(_config,
            loggerFactory.CreateLogger<UdpListener>());
        _parser = new MessageParser(
            loggerFactory.CreateLogger<MessageParser>(), _statusCache);
        _commandSender = new WsjtxCommandSender(_config,
            loggerFactory.CreateLogger<WsjtxCommandSender>());

        _parser.DecodeReceived += (_, decode) =>
        {
            var status = _statusCache.Get(decode.Id);
            var freqMhz = status.DialFreqHz > 0
                ? (status.DialFreqHz + decode.DeltaFreqHz) / 1_000_000.0
                : decode.DeltaFreqHz / 1_000_000.0;

            string? dxCall = null, dxGrid = null;
            var parts = decode.Message.Trim()
                .Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 2)
            {
                if (parts[0].Equals("CQ", StringComparison.OrdinalIgnoreCase)
                    && parts.Length >= 3)
                {
                    dxCall = parts[1];
                    if (parts[2].Length == 4 || parts[2].Length == 6) dxGrid = parts[2];
                }
                else dxCall = parts[1];
            }

            _decodeBuffer.Enqueue(new WsjtxDecodeDto(
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
            _logBuffer.Add($"[DECODE] {decode.Message} SNR={decode.Snr}");
        };

        var qsoChannel = Channel.CreateUnbounded<ParsedQsoLogged>(
            new UnboundedChannelOptions { SingleReader = true });
        ct.Register(() => qsoChannel.Writer.TryComplete());

        _parser.QsoLoggedReceived += (_, qso) => qsoChannel.Writer.TryWrite(qso);

        _ = Task.Run(async () =>
        {
            await foreach (var qso in qsoChannel.Reader.ReadAllAsync(CancellationToken.None))
            {
                try
                {
                    await _apiClient.PostQsoAsync(new WsjtxQsoDto(
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
                    _logBuffer.Add($"[QSO] Auto-logged {qso.DxCall}");
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    _logBuffer.Add($"[ERROR] QSO log failed: {ex.Message}");
                }
            }
        }, CancellationToken.None);

        _udpListener.DatagramReceived += (_, datagram) =>
        {
            _commandSender.SetTarget(datagram.RemoteEndPoint);
            _parser.Parse(datagram.Data);
        };
        try
        {
            _decodeBuffer.Start(ct);
            _udpListener.Start(ct);
            _logBuffer.Add($"[UDP] Listening on port {_config.UdpPort}");
            _ = Task.Run(() => PollCommandsAsync(_statusCache, _commandSender, ct), CancellationToken.None);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logBuffer.Add($"[ERROR] WSJT-X listener failed: {ex.Message}");
            WpfApplication.Current.Dispatcher.Invoke(() => UpdateIcon(ConnectionState.Error));
        }
    }

    private async Task PollCommandsAsync(StatusCache statusCache, WsjtxCommandSender commandSender, CancellationToken ct)
    {
        if (_apiClient == null) return;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (!ct.IsCancellationRequested && await timer.WaitForNextTickAsync(ct))
        {
            WsjtxAgentCommand? command;
            try
            {
                command = await _apiClient.GetNextCommandAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logBuffer.Add($"[ERROR] Command poll failed: {ex.Message}");
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
                        await commandSender.SendReplyAsync(command.Reply, ct);
                        success = true;
                        message = "Reply sendt til WSJT-X.";
                        break;
                    case WsjtxCommandType.StartCq:
                        if (!statusCache.TryGetLatest(out var wsjtxId, out _))
                        {
                            message = "WSJT-X har ikke sendt status endnu.";
                            break;
                        }
                        if (string.IsNullOrWhiteSpace(command.CqCallsign))
                        {
                            message = "Mangler kaldesignal til CQ.";
                            break;
                        }
                        await commandSender.SendStartCqAsync(wsjtxId, command.CqCallsign, ct);
                        success = true;
                        message = "CQ sendt til WSJT-X.";
                        break;
                    default:
                        message = "Ukendt WSJT-X kommando.";
                        break;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                message = ex.Message;
                _logBuffer.Add($"[ERROR] Command failed: {ex.Message}");
            }

            await _apiClient.CompleteCommandAsync(command.Id, command.Type, success, message, ct);
            _logBuffer.Add($"[COMMAND] {message}");
        }
    }

    private async Task RestartAsync()
    {
        _cts.Cancel();
        try { await _runTask.ConfigureAwait(false); }
        catch (OperationCanceledException) { }
        _cts.Dispose();
        _udpListener?.Dispose();
        _decodeBuffer?.Dispose();
        _httpClient?.Dispose();
        _httpClient = null;
        _apiClient = null;
        _cts = new CancellationTokenSource();
        WpfApplication.Current.Dispatcher.Invoke(() => UpdateIcon(ConnectionState.Disconnected));
        _runTask = StartAsync(_cts.Token);
    }

    public void Dispose()
    {
        _cts.Cancel();
        try { _runTask.Wait(TimeSpan.FromSeconds(3)); } catch { /* best effort */ }
        _cts.Dispose();
        _udpListener?.Dispose();
        _decodeBuffer?.Dispose();
        _httpClient?.Dispose();
        if (_trayIcon != null)
        {
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
        }
    }
}

public class LogBuffer
{
    private readonly Queue<string> _lines = new();
    public event EventHandler<string>? LineAdded;

    public void Add(string line)
    {
        var entry = $"{DateTime.Now:HH:mm:ss} {line}";
        lock (_lines)
        {
            _lines.Enqueue(entry);
            while (_lines.Count > 500) _lines.Dequeue();
        }
        LineAdded?.Invoke(this, entry);
    }

    public IEnumerable<string> GetAll()
    {
        lock (_lines) return _lines.ToList();
    }
}
