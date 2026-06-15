using System.Net;
using System.Net.Sockets;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxCore;

public class WsjtxCommandSender
{
    private readonly HamHubConfig _config;
    private readonly ILogger<WsjtxCommandSender> _logger;
    private IPEndPoint? _targetEndPoint;

    public WsjtxCommandSender(HamHubConfig config, ILogger<WsjtxCommandSender> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendReplyAsync(WsjtxReplyCommand command, CancellationToken ct)
    {
        await SendAsync(WsjtxCommandMessageBuilder.BuildReply(command), ct);
        _logger.LogInformation("Sent WSJT-X Reply for {Message}", command.Message);
    }

    public async Task SendStartCqAsync(string wsjtxId, string callsign, CancellationToken ct)
    {
        var text = $"CQ {callsign.Trim().ToUpperInvariant()}";
        await SendAsync(WsjtxCommandMessageBuilder.BuildFreeText(wsjtxId, text, send: true), ct);
        _logger.LogInformation("Sent WSJT-X CQ free-text command: {Text}", text);
    }

    public void SetTarget(IPEndPoint targetEndPoint)
    {
        _targetEndPoint = targetEndPoint;
        _logger.LogDebug("Updated WSJT-X command target to {Target}", targetEndPoint);
    }

    private async Task SendAsync(byte[] datagram, CancellationToken ct)
    {
        using var udp = new UdpClient();
        var target = _targetEndPoint ?? new IPEndPoint(
            string.IsNullOrWhiteSpace(_config.UdpMulticast) ? IPAddress.Loopback : IPAddress.Parse(_config.UdpMulticast),
            _config.UdpPort);
        await udp.SendAsync(datagram, target, ct);
        _logger.LogInformation("Sent WSJT-X command datagram to {Target}", target);
    }
}
