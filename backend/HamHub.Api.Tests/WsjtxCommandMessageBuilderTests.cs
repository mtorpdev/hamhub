using System.Buffers.Binary;
using System.Text;
using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using Xunit;

namespace HamHub.Api.Tests;

public class WsjtxCommandMessageBuilderTests
{
    [Fact]
    public void BuildReplyWritesWsjtxReplyDatagram()
    {
        var command = new WsjtxReplyCommand(
            WsjtxId: "WSJT-X",
            TimeMs: 45_000,
            Snr: -11,
            DeltaTime: 0.2,
            DeltaFreqHz: 1_234,
            Mode: "FT8",
            Message: "CQ OZ1ABC JO55",
            LowConfidence: false);

        var datagram = WsjtxCommandMessageBuilder.BuildReply(command);

        var pos = 0;
        Assert.Equal(0xADBCCBDAu, ReadUInt32(datagram, ref pos));
        Assert.Equal(2u, ReadUInt32(datagram, ref pos));
        Assert.Equal(4u, ReadUInt32(datagram, ref pos));
        Assert.Equal("WSJT-X", ReadString(datagram, ref pos));
        Assert.Equal(45_000u, ReadUInt32(datagram, ref pos));
        Assert.Equal(-11, ReadInt32(datagram, ref pos));
        Assert.Equal(0.2, ReadDouble(datagram, ref pos), precision: 6);
        Assert.Equal(1_234u, ReadUInt32(datagram, ref pos));
        Assert.Equal("FT8", ReadString(datagram, ref pos));
        Assert.Equal("CQ OZ1ABC JO55", ReadString(datagram, ref pos));
        Assert.False(ReadBool(datagram, ref pos));
        Assert.Equal(0, datagram[pos]);
    }

    private static uint ReadUInt32(byte[] data, ref int pos)
    {
        var value = BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(pos));
        pos += 4;
        return value;
    }

    private static int ReadInt32(byte[] data, ref int pos)
    {
        var value = BinaryPrimitives.ReadInt32BigEndian(data.AsSpan(pos));
        pos += 4;
        return value;
    }

    private static double ReadDouble(byte[] data, ref int pos)
    {
        var value = BinaryPrimitives.ReadDoubleBigEndian(data.AsSpan(pos));
        pos += 8;
        return value;
    }

    private static bool ReadBool(byte[] data, ref int pos) => data[pos++] != 0;

    private static string ReadString(byte[] data, ref int pos)
    {
        var length = (int)ReadUInt32(data, ref pos);
        var value = Encoding.UTF8.GetString(data.AsSpan(pos, length));
        pos += length;
        return value;
    }
}
