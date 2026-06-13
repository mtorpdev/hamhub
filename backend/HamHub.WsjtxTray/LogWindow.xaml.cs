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

        EventHandler<string> handler = null!;
        handler = (_, line) =>
        {
            Dispatcher.Invoke(() =>
            {
                LogList.Items.Add(line);
                if (LogList.Items.Count > 0)
                    LogList.ScrollIntoView(LogList.Items[^1]);
            });
        };
        _buffer.LineAdded += handler;
        Closed += (_, _) => _buffer.LineAdded -= handler;
    }
}
