using System.Net;
using System.Net.Sockets;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxCore;

public class UdpListener : IDisposable
{
    private readonly HamHubConfig _config;
    private readonly ILogger<UdpListener> _logger;
    private UdpClient? _udp;

    public event EventHandler<byte[]>? MessageReceived;

    public UdpListener(HamHubConfig config, ILogger<UdpListener> logger)
    {
        _config = config;
        _logger = logger;
    }

    public void Start(CancellationToken ct)
    {
        _udp = new UdpClient();
        _udp.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
        _udp.Client.Bind(new IPEndPoint(IPAddress.Any, _config.UdpPort));

        if (!string.IsNullOrWhiteSpace(_config.UdpMulticast))
        {
            _udp.JoinMulticastGroup(IPAddress.Parse(_config.UdpMulticast));
            _logger.LogInformation("Joined multicast group {Group}", _config.UdpMulticast);
        }

        _logger.LogInformation("Listening for WSJT-X on UDP port {Port}", _config.UdpPort);
        _ = ListenLoopAsync(ct);
    }

    private async Task ListenLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var result = await _udp!.ReceiveAsync(ct);
                MessageReceived?.Invoke(this, result.Buffer);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UDP receive error");
            }
        }
    }

    public void Dispose() => _udp?.Dispose();
}
