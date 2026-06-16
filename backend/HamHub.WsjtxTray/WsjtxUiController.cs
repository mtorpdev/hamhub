using System.Diagnostics;
using System.Windows.Automation;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxTray;

public class WsjtxUiController
{
    private readonly ILogger<WsjtxUiController> _logger;

    public WsjtxUiController(ILogger<WsjtxUiController> logger)
    {
        _logger = logger;
    }

    public Task StopTxAsync(CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var root = GetMainWindow();
        InvokeByAutomationId(root, "stopTxButton", "Stop Tx");

        _logger.LogInformation("Stopped WSJT-X transmission through local UI automation");
        return Task.CompletedTask;
    }

    private static AutomationElement GetMainWindow()
    {
        var process = GetMainWindowProcess();

        var root = AutomationElement.FromHandle(process.MainWindowHandle);
        if (root is null)
            throw new InvalidOperationException("WSJT-X automation-root blev ikke fundet.");

        return root;
    }

    private static Process GetMainWindowProcess()
    {
        var process = Process.GetProcessesByName("wsjtx")
            .FirstOrDefault(p => p.MainWindowHandle != IntPtr.Zero);

        if (process is null)
            throw new InvalidOperationException("WSJT-X vinduet blev ikke fundet.");

        return process;
    }

    private static void InvokeByAutomationId(AutomationElement root, string automationIdSuffix, string label)
    {
        var element = FindByAutomationIdSuffix(root, automationIdSuffix)
            ?? throw new InvalidOperationException($"WSJT-X kontrol '{label}' blev ikke fundet.");

        if (!element.Current.IsEnabled)
            throw new InvalidOperationException($"WSJT-X kontrol '{label}' er ikke aktiv.");

        if (!element.TryGetCurrentPattern(InvokePattern.Pattern, out var pattern))
            throw new InvalidOperationException($"WSJT-X kontrol '{label}' kan ikke trykkes.");

        ((InvokePattern)pattern).Invoke();
    }

    private static AutomationElement? FindByAutomationIdSuffix(AutomationElement root, string suffix)
    {
        var elements = root.FindAll(TreeScope.Descendants, Condition.TrueCondition);
        foreach (AutomationElement element in elements)
        {
            if (element.Current.AutomationId.EndsWith("." + suffix, StringComparison.Ordinal)
                || element.Current.AutomationId.Equals(suffix, StringComparison.Ordinal))
            {
                return element;
            }
        }

        return null;
    }
}
