using System.Security.Claims;
using HamHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace HamHub.Api.Hubs;

[Authorize]
public class CommunityChatHub : Hub
{
    private readonly CommunityPresenceTracker _presence;

    public CommunityChatHub(CommunityPresenceTracker presence)
    {
        _presence = presence;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrWhiteSpace(userId))
        {
            _presence.Connect(userId, Context.ConnectionId);
            await Clients.All.SendAsync("CommunityPresenceChanged");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = _presence.Disconnect(Context.ConnectionId);
        if (!string.IsNullOrWhiteSpace(userId))
        {
            await Clients.All.SendAsync("CommunityPresenceChanged");
        }

        await base.OnDisconnectedAsync(exception);
    }

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
