// HamHub.Api/Services/WsjtxBroadcaster.cs
using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using HamHub.Application.Wsjtx.DTOs;

namespace HamHub.Api.Services;

public class WsjtxBroadcaster
{
    private readonly ConcurrentDictionary<Guid, Channel<WsjtxDecodeDto>> _clients = new();

    public async IAsyncEnumerable<WsjtxDecodeDto> Subscribe(
        [EnumeratorCancellation] CancellationToken ct)
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateUnbounded<WsjtxDecodeDto>(
            new UnboundedChannelOptions { SingleReader = true });
        _clients[id] = channel;
        try
        {
            await foreach (var item in channel.Reader.ReadAllAsync(ct))
                yield return item;
        }
        finally
        {
            _clients.TryRemove(id, out _);
        }
    }

    public void Broadcast(IEnumerable<WsjtxDecodeDto> decodes)
    {
        var list = decodes.ToList();
        foreach (var (_, channel) in _clients)
            foreach (var decode in list)
                channel.Writer.TryWrite(decode);
    }
}
