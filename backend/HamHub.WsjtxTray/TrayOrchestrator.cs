using System.Diagnostics;
using System.Net.Http;
using System.Threading;
using System.Threading.Channels;
using System.Windows;
using System.Windows.Controls;
using Hardcodet.Wpf.TaskbarNotification;
using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxTray;

public enum ConnectionState { Disconnected, Connected, Error }

public class TrayOrchestrator : IDisposable
{
    private TaskbarIcon? _trayIcon;
    private HamHubConfig _config = new();
    private HamHubApiClient? _apiClient;
    private UdpListener? _udpListener;
    private DecodeBuffer? _decodeBuffer;
    private MessageParser? _parser;
    private StatusCache? _statusCache;
    private readonly LogBuffer _logBuffer = new();
    private CancellationTokenSource _cts = new();
    private ConnectionState _state = ConnectionState.Disconnected;
    private Task _runTask = Task.CompletedTask;

    public event EventHandler? ExitRequested;

    public void Initialize()
    {
        _config = ConfigStore.Load();
        _trayIcon = new TaskbarIcon();
        UpdateIcon(ConnectionState.Disconnected);
        BuildContextMenu();
        _runTask = StartAsync(_cts.Token);
    }

    private void BuildContextMenu()
    {
        if (_trayIcon == null) return;
        var menu = new ContextMenu();

        var statusItem = new MenuItem { Header = GetStatusText(), IsEnabled = false };
        menu.Items.Add(statusItem);
        menu.Items.Add(new Separator());

        var openItem = new MenuItem { Header = "Åbn HamHub" };
        openItem.Click += (_, _) =>
        {
            if (!string.IsNullOrWhiteSpace(_config.ServerUrl))
                Process.Start(new ProcessStartInfo(_config.ServerUrl) { UseShellExecute = true });
        };
        menu.Items.Add(openItem);

        var settingsItem = new MenuItem { Header = "Indstillinger" };
        settingsItem.Click += (_, _) =>
        {
            var win = new SettingsWindow(_config);
            if (win.ShowDialog() == true)
            {
                _config = win.Config;
                ConfigStore.Save(_config);
                _ = RestartAsync();
            }
        };
        menu.Items.Add(settingsItem);

        var logItem = new MenuItem { Header = "Se log" };
        logItem.Click += (_, _) => new LogWindow(_logBuffer).Show();
        menu.Items.Add(logItem);

        menu.Items.Add(new Separator());
        var exitItem = new MenuItem { Header = "Afslut" };
        exitItem.Click += (_, _) => ExitRequested?.Invoke(this, EventArgs.Empty);
        menu.Items.Add(exitItem);

        _trayIcon.ContextMenu = menu;
    }

    private string GetStatusText() => _state switch
    {
        ConnectionState.Connected => $"Tilsluttet som {_config.Username}",
        ConnectionState.Error => "Fejl – se log",
        _ => "Ikke tilsluttet"
    };

    private void UpdateIcon(ConnectionState state)
    {
        if (!Application.Current.Dispatcher.CheckAccess())
        {
            Application.Current.Dispatcher.Invoke(() => UpdateIcon(state));
            return;
        }
        _state = state;
        if (_trayIcon == null) return;
        var iconPath = state switch
        {
            ConnectionState.Connected => "pack://application:,,,/Resources/icon-green.ico",
            ConnectionState.Error => "pack://application:,,,/Resources/icon-red.ico",
            _ => "pack://application:,,,/Resources/icon-grey.ico"
        };
        var uri = new Uri(iconPath, UriKind.Absolute);
        var stream = Application.GetResourceStream(uri)?.Stream;
        if (stream != null)
            _trayIcon.Icon = new System.Drawing.Icon(stream);
        _trayIcon.ToolTipText = GetStatusText();
        BuildContextMenu();
    }

    private async Task StartAsync(CancellationToken ct)
    {
        using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());

        // Login with retry — one HttpClient for the entire retry loop
        var http = new HttpClient();
        _apiClient = null;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                _apiClient = new HamHubApiClient(http, _config,
                    loggerFactory.CreateLogger<HamHubApiClient>());
                await _apiClient.LoginAsync(ct);
                Application.Current.Dispatcher.Invoke(
                    () => UpdateIcon(ConnectionState.Connected));
                break;
            }
            catch (OperationCanceledException) { return; }
            catch (Exception ex)
            {
                _logBuffer.Add($"[ERROR] Login failed: {ex.Message}");
                Application.Current.Dispatcher.Invoke(
                    () => UpdateIcon(ConnectionState.Error));
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
            _logBuffer.Add($"[DECODE] {decode.Message} SNR={decode.Snr}");
        };

        // QSO handler uses Channel to avoid async void
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

        _udpListener.MessageReceived += (_, data) => _parser.Parse(data);
        _decodeBuffer.Start(ct);
        _udpListener.Start(ct);
    }

    private async Task RestartAsync()
    {
        _cts.Cancel();
        try { await _runTask.ConfigureAwait(false); }
        catch (OperationCanceledException) { }
        _cts.Dispose();
        _udpListener?.Dispose();
        _decodeBuffer?.Dispose();
        _apiClient = null;
        _cts = new CancellationTokenSource();
        Application.Current.Dispatcher.Invoke(
            () => UpdateIcon(ConnectionState.Disconnected));
        _runTask = StartAsync(_cts.Token);
    }

    public void Dispose()
    {
        _cts.Cancel();
        _cts.Dispose();
        _udpListener?.Dispose();
        _decodeBuffer?.Dispose();
        _trayIcon?.Dispose();
    }
}

// Circular log buffer (thread-safe)
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
