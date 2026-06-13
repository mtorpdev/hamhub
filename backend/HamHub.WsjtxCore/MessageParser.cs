using System.Buffers.Binary;
using System.Text;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxCore;

public class ParsedDecode
{
    public string Id { get; set; } = string.Empty;
    public uint Schema { get; set; }
    public bool IsNew { get; set; }
    public uint TimeMs { get; set; }
    public int Snr { get; set; }
    public double DeltaTime { get; set; }
    public uint DeltaFreqHz { get; set; }
    public string Mode { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool LowConfidence { get; set; }
    public bool OffAir { get; set; }
}

public class ParsedQsoLogged
{
    public string Id { get; set; } = string.Empty;
    public uint Schema { get; set; }
    public DateTime TimeOff { get; set; }
    public string DxCall { get; set; } = string.Empty;
    public string DxGrid { get; set; } = string.Empty;
    public ulong TxFreqHz { get; set; }
    public string Mode { get; set; } = string.Empty;
    public string ReportSent { get; set; } = string.Empty;
    public string ReportReceived { get; set; } = string.Empty;
    public string TxPower { get; set; } = string.Empty;
    public string Comments { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime TimeOn { get; set; }
    public string OperatorCall { get; set; } = string.Empty;
    public string MyCall { get; set; } = string.Empty;
    public string MyGrid { get; set; } = string.Empty;
    public string ExchangeSent { get; set; } = string.Empty;
    public string ExchangeReceived { get; set; } = string.Empty;
    public string? AdifPropMode { get; set; }
}

public class MessageParser
{
    private const uint Magic = 0xADBCCBDA;
    private readonly ILogger<MessageParser> _logger;
    private readonly StatusCache _statusCache;

    public event EventHandler<ParsedDecode>? DecodeReceived;
    public event EventHandler<ParsedQsoLogged>? QsoLoggedReceived;

    public MessageParser(ILogger<MessageParser> logger, StatusCache statusCache)
    {
        _logger = logger;
        _statusCache = statusCache;
    }

    public void Parse(byte[] data)
    {
        try
        {
            var span = data.AsSpan();
            int pos = 0;

            var magic = ReadUInt32(span, ref pos);
            if (magic != Magic) return;

            var schema = ReadUInt32(span, ref pos);
            if (schema < 2) return;

            var type = ReadUInt32(span, ref pos);
            var id = ReadString(span, ref pos);

            switch (type)
            {
                case 1: ParseStatus(span, ref pos, id, schema); break;
                case 2: ParseDecode(span, ref pos, id, schema); break;
                case 5: ParseQsoLogged(span, ref pos, id, schema); break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to parse WSJT-X datagram ({Length} bytes)", data.Length);
        }
    }

    private void ParseStatus(ReadOnlySpan<byte> span, ref int pos, string id, uint schema)
    {
        // Field order per spec: dial_freq, mode, dx_call, report, tx_mode,
        // tx_enabled, transmitting, decoding, rx_df, tx_df, de_call, …
        var dialFreq = ReadUInt64(span, ref pos);
        var mode = ReadString(span, ref pos);
        ReadString(span, ref pos);  // dx_call (skip)
        ReadString(span, ref pos);  // report (skip)
        ReadString(span, ref pos);  // tx_mode (skip)
        ReadBool(span, ref pos);    // tx_enabled (skip)
        ReadBool(span, ref pos);    // transmitting (skip)
        ReadBool(span, ref pos);    // decoding (skip)
        ReadUInt32(span, ref pos);  // rx_df (skip)
        ReadUInt32(span, ref pos);  // tx_df (skip)
        var deCall = ReadString(span, ref pos); // spotter callsign

        _statusCache.Update(id, new StatusEntry
        {
            DialFreqHz = dialFreq,
            Mode = mode,
            DeCall = deCall
        });
    }

    private void ParseDecode(ReadOnlySpan<byte> span, ref int pos, string id, uint schema)
    {
        var isNew = ReadBool(span, ref pos);
        var timeMs = ReadUInt32(span, ref pos);
        var snr = ReadInt32(span, ref pos);
        var deltaTime = ReadDouble(span, ref pos);
        var deltaFreqHz = ReadUInt32(span, ref pos);
        var mode = ReadString(span, ref pos);
        var message = ReadString(span, ref pos);
        var lowConfidence = ReadBool(span, ref pos);
        var offAir = ReadBool(span, ref pos);

        DecodeReceived?.Invoke(this, new ParsedDecode
        {
            Id = id,
            Schema = schema,
            IsNew = isNew,
            TimeMs = timeMs,
            Snr = snr,
            DeltaTime = deltaTime,
            DeltaFreqHz = deltaFreqHz,
            Mode = mode,
            Message = message,
            LowConfidence = lowConfidence,
            OffAir = offAir
        });
    }

    private void ParseQsoLogged(ReadOnlySpan<byte> span, ref int pos, string id, uint schema)
    {
        var timeOff = ReadQDateTime(span, ref pos);
        var dxCall = ReadString(span, ref pos);
        var dxGrid = ReadString(span, ref pos);
        var txFreqHz = ReadUInt64(span, ref pos);
        var mode = ReadString(span, ref pos);
        var reportSent = ReadString(span, ref pos);
        var reportReceived = ReadString(span, ref pos);
        var txPower = ReadString(span, ref pos);
        var comments = ReadString(span, ref pos);
        var name = ReadString(span, ref pos);
        var timeOn = ReadQDateTime(span, ref pos);
        var operatorCall = ReadString(span, ref pos);
        var myCall = ReadString(span, ref pos);
        var myGrid = ReadString(span, ref pos);
        var exchangeSent = ReadString(span, ref pos);
        var exchangeReceived = ReadString(span, ref pos);

        string? adifPropMode = null;
        if (schema >= 3 && pos < span.Length)
            adifPropMode = ReadString(span, ref pos);

        QsoLoggedReceived?.Invoke(this, new ParsedQsoLogged
        {
            Id = id,
            Schema = schema,
            TimeOff = timeOff,
            DxCall = dxCall,
            DxGrid = dxGrid,
            TxFreqHz = txFreqHz,
            Mode = mode,
            ReportSent = reportSent,
            ReportReceived = reportReceived,
            TxPower = txPower,
            Comments = comments,
            Name = name,
            TimeOn = timeOn,
            OperatorCall = operatorCall,
            MyCall = myCall,
            MyGrid = myGrid,
            ExchangeSent = exchangeSent,
            ExchangeReceived = exchangeReceived,
            AdifPropMode = adifPropMode
        });
    }

    private static uint ReadUInt32(ReadOnlySpan<byte> span, ref int pos)
    {
        var val = BinaryPrimitives.ReadUInt32BigEndian(span[pos..]);
        pos += 4;
        return val;
    }

    private static int ReadInt32(ReadOnlySpan<byte> span, ref int pos)
    {
        var val = BinaryPrimitives.ReadInt32BigEndian(span[pos..]);
        pos += 4;
        return val;
    }

    private static ulong ReadUInt64(ReadOnlySpan<byte> span, ref int pos)
    {
        var val = BinaryPrimitives.ReadUInt64BigEndian(span[pos..]);
        pos += 8;
        return val;
    }

    private static double ReadDouble(ReadOnlySpan<byte> span, ref int pos)
    {
        var val = BinaryPrimitives.ReadDoubleBigEndian(span[pos..]);
        pos += 8;
        return val;
    }

    private static bool ReadBool(ReadOnlySpan<byte> span, ref int pos)
    {
        return span[pos++] != 0;
    }

    private static string ReadString(ReadOnlySpan<byte> span, ref int pos)
    {
        var len = BinaryPrimitives.ReadUInt32BigEndian(span[pos..]);
        pos += 4;
        if (len == 0xFFFFFFFF) return string.Empty; // null → empty
        var str = Encoding.UTF8.GetString(span[pos..(pos + (int)len)]);
        pos += (int)len;
        return str;
    }

    private static DateTime ReadQDateTime(ReadOnlySpan<byte> span, ref int pos)
    {
        // Julian Day Number (uint64)
        var julianDay = BinaryPrimitives.ReadUInt64BigEndian(span[pos..]);
        pos += 8;
        // ms since midnight (uint32)
        var msOfDay = BinaryPrimitives.ReadUInt32BigEndian(span[pos..]);
        pos += 4;
        // timespec (uint8): 1 = UTC — skip, treat all as UTC
        pos += 1;

        // JDN 2440588 = 1970-01-01
        var epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        return epoch.AddDays(julianDay - 2440588).AddMilliseconds(msOfDay);
    }
}
