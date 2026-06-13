namespace HamHub.WsjtxCore.Models;

public class HamHubConfig
{
    public string ServerUrl { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public int UdpPort { get; set; } = 2237;
    public string UdpMulticast { get; set; } = string.Empty;
}
