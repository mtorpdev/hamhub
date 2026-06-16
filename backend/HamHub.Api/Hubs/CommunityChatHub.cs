using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace HamHub.Api.Hubs;

[Authorize]
public class CommunityChatHub : Hub
{
    public Task JoinRoom(string roomSlug)
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, RoomGroup(roomSlug));
    }

    public Task LeaveRoom(string roomSlug)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroup(roomSlug));
    }

    public static string RoomGroup(string roomSlug)
    {
        var normalized = string.IsNullOrWhiteSpace(roomSlug)
            ? "alle"
            : roomSlug.Trim().ToLowerInvariant();
        return $"community-room:{normalized}";
    }
}
