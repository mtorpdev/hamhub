using System.Diagnostics;
using System.Windows.Automation;

namespace HamHub.WsjtxService;

public class WsjtxUiController
{
    private readonly ILogger<WsjtxUiController> _logger;

    public WsjtxUiController(ILogger<WsjtxUiController> logger)
    {
        _logger = logger;
    }

    public Task StartCqAsync(CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var root = GetMainWindow();
        InvokeByAutomationId(root, "genStdMsgsPushButton", "Generate Std Medd");
        SelectRadioByAutomationId(root, "txrb6", "Tx6 now");
        EnsureToggleOn(root, "autoButton", "Aktiver Tx");

        _logger.LogInformation("Activated WSJT-X Start CQ through local UI automation");
        return Task.CompletedTask;
    }

    public Task StopTxAsync(CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var root = GetMainWindow();
        InvokeByAutomationId(root, "stopTxButton", "Stop Tx");

        _logger.LogInformation("Stopped WSJT-X transmission through local UI automation");
        return Task.CompletedTask;
    }

    public Task StartCallingAsync(CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var root = GetMainWindow();
        SelectRadioByAutomationId(root, "txrb1", "Tx1 now");
        EnsureToggleOn(root, "autoButton", "Aktiver Tx");

        _logger.LogInformation("Activated WSJT-X calling through local UI automation");
        return Task.CompletedTask;
    }

    private static AutomationElement GetMainWindow()
    {
        var process = Process.GetProcessesByName("wsjtx")
            .FirstOrDefault(p => p.MainWindowHandle != IntPtr.Zero);

        if (process is null)
            throw new InvalidOperationException("WSJT-X vinduet blev ikke fundet.");

        var root = AutomationElement.FromHandle(process.MainWindowHandle);
        if (root is null)
            throw new InvalidOperationException("WSJT-X automation-root blev ikke fundet.");

        return root;
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

    private static void SelectRadioByAutomationId(AutomationElement root, string automationIdSuffix, string label)
    {
        var element = FindByAutomationIdSuffix(root, automationIdSuffix)
            ?? throw new InvalidOperationException($"WSJT-X valg '{label}' blev ikke fundet.");

        if (element.TryGetCurrentPattern(SelectionItemPattern.Pattern, out var selectionPattern))
        {
            ((SelectionItemPattern)selectionPattern).Select();
            return;
        }

        if (element.TryGetCurrentPattern(TogglePattern.Pattern, out var togglePattern))
        {
            ((TogglePattern)togglePattern).Toggle();
            return;
        }

        throw new InvalidOperationException($"WSJT-X valg '{label}' kan ikke aktiveres.");
    }

    private static void EnsureToggleOn(AutomationElement root, string automationIdSuffix, string label)
    {
        var element = FindByAutomationIdSuffix(root, automationIdSuffix)
            ?? throw new InvalidOperationException($"WSJT-X kontrol '{label}' blev ikke fundet.");

        if (!element.Current.IsEnabled)
            throw new InvalidOperationException($"WSJT-X kontrol '{label}' er ikke aktiv.");

        if (element.TryGetCurrentPattern(TogglePattern.Pattern, out var togglePattern))
        {
            var toggle = (TogglePattern)togglePattern;
            if (toggle.Current.ToggleState != ToggleState.On)
            {
                toggle.Toggle();
            }
            return;
        }

        if (element.TryGetCurrentPattern(InvokePattern.Pattern, out var invokePattern))
        {
            ((InvokePattern)invokePattern).Invoke();
            return;
        }

        throw new InvalidOperationException($"WSJT-X kontrol '{label}' kan ikke aktiveres.");
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
