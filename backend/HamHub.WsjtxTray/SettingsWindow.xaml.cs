using System.Windows;
using HamHub.WsjtxCore.Models;

namespace HamHub.WsjtxTray;

public partial class SettingsWindow : Window
{
    public HamHubConfig Config { get; private set; }

    public SettingsWindow(HamHubConfig current)
    {
        InitializeComponent();
        Config = current;
        TxtServerUrl.Text = current.ServerUrl;
        TxtUsername.Text = current.Username;
        TxtPassword.Password = current.Password;
        TxtUdpPort.Text = current.UdpPort.ToString();
        TxtMulticast.Text = current.UdpMulticast;
    }

    private void Save_Click(object sender, RoutedEventArgs e)
    {
        Config = new HamHubConfig
        {
            ServerUrl = TxtServerUrl.Text.Trim(),
            Username = TxtUsername.Text.Trim(),
            Password = TxtPassword.Password,
            UdpPort = int.TryParse(TxtUdpPort.Text, out var p) ? p : 2237,
            UdpMulticast = TxtMulticast.Text.Trim()
        };
        DialogResult = true;
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) => DialogResult = false;
}
