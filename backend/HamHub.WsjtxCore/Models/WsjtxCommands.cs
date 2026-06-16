namespace HamHub.WsjtxCore.Models;

public record WsjtxReplyCommand(
    string WsjtxId,
    uint TimeMs,
    int Snr,
    double DeltaTime,
    uint DeltaFreqHz,
    string Mode,
    string Message,
    bool LowConfidence);

public enum WsjtxCommandType
{
    Reply = 1,
    StopTx = 3
}

public record WsjtxAgentCommand(
    Guid Id,
    WsjtxCommandType Type,
    WsjtxReplyCommand? Reply);

public record WsjtxCommandResult(
    Guid Id,
    WsjtxCommandType Type,
    bool Success,
    string Message,
    DateTime CompletedAtUtc);
