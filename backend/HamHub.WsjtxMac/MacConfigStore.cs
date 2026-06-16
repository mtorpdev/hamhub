using System.Text.Json;
using HamHub.WsjtxCore.Models;

namespace HamHub.WsjtxMac;

internal static class MacConfigStore
{
    private static readonly string ConfigPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        "Library", "Application Support", "HamHub", "wsjtx-agent.json");

    public static string PathForDisplay => ConfigPath;

    public static HamHubConfig Load()
    {
        if (!File.Exists(ConfigPath))
            return new HamHubConfig();

        try
        {
            var json = File.ReadAllText(ConfigPath);
            return Normalize(JsonSerializer.Deserialize<HamHubConfig>(json) ?? new HamHubConfig());
        }
        catch
        {
            return new HamHubConfig();
        }
    }

    public static void Save(HamHubConfig config)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(ConfigPath)!);
        File.WriteAllText(
            ConfigPath,
            JsonSerializer.Serialize(Normalize(config), new JsonSerializerOptions { WriteIndented = true }));
    }

    private static HamHubConfig Normalize(HamHubConfig config)
    {
        if (string.IsNullOrWhiteSpace(config.ServerUrl))
            config.ServerUrl = HamHubConfig.DefaultServerUrl;
        if (config.UdpPort <= 0)
            config.UdpPort = 2237;
        return config;
    }
}
