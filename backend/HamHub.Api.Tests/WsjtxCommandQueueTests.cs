using HamHub.Api.Services;
using HamHub.WsjtxCore.Models;
using Xunit;

namespace HamHub.Api.Tests;

public class WsjtxCommandQueueTests
{
    [Fact]
    public void TryDequeueReturnsCommandsForTheRequestedUserOnly()
    {
        var queue = new WsjtxCommandQueue();

        var userCommand = queue.EnqueueReply("user-1", new WsjtxReplyCommand(
            WsjtxId: "WSJT-X",
            TimeMs: 10,
            Snr: -5,
            DeltaTime: 0.1,
            DeltaFreqHz: 1_500,
            Mode: "FT8",
            Message: "CQ OZ1ABC JO55",
            LowConfidence: false));
        queue.EnqueueStartCq("user-2", "OZ2XYZ");

        Assert.False(queue.TryDequeue("user-2", out var wrongUserCommand) && wrongUserCommand.Id == userCommand.Id);
        Assert.True(queue.TryDequeue("user-1", out var dequeued));
        Assert.Equal(userCommand.Id, dequeued.Id);
        Assert.Equal(WsjtxCommandType.Reply, dequeued.Type);
        Assert.False(queue.TryDequeue("user-1", out _));
    }

    [Fact]
    public void CompleteStoresCommandResult()
    {
        var queue = new WsjtxCommandQueue();
        var command = queue.EnqueueStartCq("user-1", "OZ1ABC");

        Assert.True(queue.Complete("user-1", command.Id, WsjtxCommandType.StartCq, true, "Sent"));

        var results = queue.GetRecentResults("user-1");
        Assert.Single(results);
        Assert.True(results[0].Success);
        Assert.Equal("Sent", results[0].Message);
    }
}
