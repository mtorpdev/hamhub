using System.Windows;

namespace HamHub.WsjtxTray;

public partial class LogWindow : Window
{
    private readonly LogBuffer _buffer;

    public LogWindow(LogBuffer buffer)
    {
        InitializeComponent();
        _buffer = buffer;

        foreach (var line in _buffer.GetAll())
            LogList.Items.Add(line);

        _buffer.LineAdded += (_, line) =>
        {
            Dispatcher.Invoke(() =>
            {
                LogList.Items.Add(line);
                if (LogList.Items.Count > 0)
                    LogList.ScrollIntoView(LogList.Items[^1]);
            });
        };
    }
}
