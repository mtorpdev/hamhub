using System.Threading.Channels;

namespace HamHub.Api.Services;

public interface IQrzSyncTrigger
{
    void NotifyQsoChanged(string userId);
    IAsyncEnumerable<string> ReadAsync(CancellationToken ct);
}

public class QrzSyncTrigger : IQrzSyncTrigger
{
    private readonly Channel<string> _channel = Channel.CreateUnbounded<string>(
        new UnboundedChannelOptions { SingleReader = true });

    public void NotifyQsoChanged(string userId) =>
        _channel.Writer.TryWrite(userId);

    public IAsyncEnumerable<string> ReadAsync(CancellationToken ct) =>
        _channel.Reader.ReadAllAsync(ct);
}
