namespace HamHub.WsjtxCore.Models;

public record WsjtxStatusDto(
    string WsjtxId,
    string DxCall,
    string DxGrid,
    string Mode,
    bool TxEnabled,
    bool Transmitting,
    bool Decoding,
    bool TxWatchdog,
    int RxDf,
    int TxDf,
    DateTime UpdatedAtUtc);
