using System.Collections.Concurrent;
using HamHub.WsjtxCore.Models;

namespace HamHub.Api.Services;

public class WsjtxCommandQueue
{
    private readonly ConcurrentDictionary<string, ConcurrentQueue<WsjtxAgentCommand>> _commands = new();
    private readonly ConcurrentDictionary<string, ConcurrentQueue<WsjtxCommandResult>> _results = new();

    public WsjtxAgentCommand EnqueueReply(string userId, WsjtxReplyCommand reply)
    {
        var command = new WsjtxAgentCommand(Guid.NewGuid(), WsjtxCommandType.Reply, reply);
        QueueFor(userId).Enqueue(command);
        return command;
    }

    public WsjtxAgentCommand EnqueueStopTx(string userId)
    {
        var command = new WsjtxAgentCommand(Guid.NewGuid(), WsjtxCommandType.StopTx, null);
        QueueFor(userId).Enqueue(command);
        return command;
    }

    public bool TryDequeue(string userId, out WsjtxAgentCommand command)
    {
        command = default!;
        return _commands.TryGetValue(userId, out var queue) && queue.TryDequeue(out command!);
    }

    public bool Complete(string userId, Guid commandId, WsjtxCommandType type, bool success, string message)
    {
        var result = new WsjtxCommandResult(commandId, type, success, message, DateTime.UtcNow);
        ResultsFor(userId).Enqueue(result);
        TrimResults(userId);
        return true;
    }

    public IReadOnlyList<WsjtxCommandResult> GetRecentResults(string userId)
    {
        return _results.TryGetValue(userId, out var queue)
            ? queue.ToArray().OrderByDescending(r => r.CompletedAtUtc).Take(10).ToList()
            : [];
    }

    private ConcurrentQueue<WsjtxAgentCommand> QueueFor(string userId) =>
        _commands.GetOrAdd(userId, _ => new ConcurrentQueue<WsjtxAgentCommand>());

    private ConcurrentQueue<WsjtxCommandResult> ResultsFor(string userId) =>
        _results.GetOrAdd(userId, _ => new ConcurrentQueue<WsjtxCommandResult>());

    private void TrimResults(string userId)
    {
        var queue = ResultsFor(userId);
        while (queue.Count > 20)
            queue.TryDequeue(out _);
    }
}
