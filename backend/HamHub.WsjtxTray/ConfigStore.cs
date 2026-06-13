using System.IO;
using System.Text.Json;
using HamHub.WsjtxCore.Models;

namespace HamHub.WsjtxTray;

public static class ConfigStore
{
    private static readonly string ConfigPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "HamHub", "wsjtx-agent.json");

    public static HamHubConfig Load()
    {
        if (!File.Exists(ConfigPath)) return new HamHubConfig();
        try
        {
            var json = File.ReadAllText(ConfigPath);
            return JsonSerializer.Deserialize<HamHubConfig>(json) ?? new HamHubConfig();
        }
        catch { return new HamHubConfig(); }
    }

    public static void Save(HamHubConfig config)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(ConfigPath)!);
        File.WriteAllText(ConfigPath, JsonSerializer.Serialize(config,
            new JsonSerializerOptions { WriteIndented = true }));
    }
}
