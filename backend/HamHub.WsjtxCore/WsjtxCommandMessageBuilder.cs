using System.Buffers.Binary;
using System.Text;
using HamHub.WsjtxCore.Models;

namespace HamHub.WsjtxCore;

public static class WsjtxCommandMessageBuilder
{
    private const uint Magic = 0xADBCCBDA;
    private const uint Schema = 2;
    private const uint ReplyType = 4;
    private const uint HaltTxType = 8;

    public static byte[] BuildReply(WsjtxReplyCommand command)
    {
        using var stream = new MemoryStream();
        WriteHeader(stream, ReplyType);
        WriteString(stream, command.WsjtxId);
        WriteUInt32(stream, command.TimeMs);
        WriteInt32(stream, command.Snr);
        WriteDouble(stream, command.DeltaTime);
        WriteUInt32(stream, command.DeltaFreqHz);
        WriteString(stream, command.Mode);
        WriteString(stream, command.Message);
        WriteBool(stream, command.LowConfidence);
        stream.WriteByte(0); // no keyboard modifiers
        return stream.ToArray();
    }

    public static byte[] BuildHaltTx(string wsjtxId, bool autoTxOnly)
    {
        using var stream = new MemoryStream();
        WriteHeader(stream, HaltTxType);
        WriteString(stream, wsjtxId);
        WriteBool(stream, autoTxOnly);
        return stream.ToArray();
    }

    private static void WriteHeader(Stream stream, uint type)
    {
        WriteUInt32(stream, Magic);
        WriteUInt32(stream, Schema);
        WriteUInt32(stream, type);
    }

    private static void WriteUInt32(Stream stream, uint value)
    {
        Span<byte> buffer = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(buffer, value);
        stream.Write(buffer);
    }

    private static void WriteInt32(Stream stream, int value)
    {
        Span<byte> buffer = stackalloc byte[4];
        BinaryPrimitives.WriteInt32BigEndian(buffer, value);
        stream.Write(buffer);
    }

    private static void WriteDouble(Stream stream, double value)
    {
        Span<byte> buffer = stackalloc byte[8];
        BinaryPrimitives.WriteDoubleBigEndian(buffer, value);
        stream.Write(buffer);
    }

    private static void WriteBool(Stream stream, bool value) => stream.WriteByte(value ? (byte)1 : (byte)0);

    private static void WriteString(Stream stream, string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        WriteUInt32(stream, (uint)bytes.Length);
        stream.Write(bytes);
    }
}
