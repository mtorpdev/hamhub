using HamHub.Infrastructure.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class LotwReportClientTests
{
    [Fact]
    public void ParseAdifReadsConfirmedQslRecords()
    {
        var adif = """
            <PROGRAMID:4>LoTW
            <APP_LoTW_NUMREC:1>1
            <EOH>
            <CALL:6>OZ1ABC<BAND:3>20M<MODE:3>FT8<QSO_DATE:8>20260616<TIME_ON:6>123000<QSL_RCVD:1>Y<QSLRDATE:8>20260617<APP_LoTW_RXQSL:19>2026-06-17 08:10:11<GRIDSQUARE:6>JO55WM<EOR>
            <APP_LoTW_EOF:1>1
            """;

        var records = LotwReportClient.ParseAdif(adif);

        var qso = Assert.Single(records);
        Assert.Equal("OZ1ABC", qso.Call);
        Assert.Equal("20M", qso.Band);
        Assert.Equal("FT8", qso.Mode);
        Assert.Equal(new DateTime(2026, 6, 16, 12, 30, 0, DateTimeKind.Utc), qso.TimeOn);
        Assert.Equal(new DateTime(2026, 6, 17, 0, 0, 0, DateTimeKind.Utc), qso.QslDate);
        Assert.Equal(new DateTime(2026, 6, 17, 8, 10, 11, DateTimeKind.Utc), qso.ReceivedAt);
        Assert.Equal("JO55WM", qso.Gridsquare);
    }

    [Fact]
    public void ParseAdifThrowsWhenLotwReturnsHtmlError()
    {
        var ex = Assert.Throws<LotwApiException>(() => LotwReportClient.ParseAdif("<html>invalid password</html>"));

        Assert.Contains("LoTW", ex.Message);
    }
}
