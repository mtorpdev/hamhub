# Community Room Chat Design

## Goal

HamHub community should have native live chat inside the community page. The first version focuses on room chat tied to existing community rooms such as DX, FT8/FT4, Teknik and Koeb/salg.

## Scope

- Logged-in users can read recent chat messages for a community room.
- Logged-in users can send short messages to the selected room.
- New messages appear live for users currently viewing the same room.
- Messages are stored in PostgreSQL so chat history survives refreshes and restarts.
- The existing private message/inbox system remains separate.

Out of scope for the first version: private 1:1 chat threads, typing indicators, file uploads, reactions, moderation UI and push notifications.

## Architecture

Backend adds a `ChatMessage` entity linked to `ApplicationUser` and optionally `CommunityRoom`. A new `ChatController` exposes REST endpoints for loading recent room history and posting a message. A SignalR `CommunityChatHub` handles live room membership and broadcasts.

The REST endpoint is the source of truth for creating messages. The hub is used for subscription and real-time delivery. This keeps validation, persistence and test coverage in normal controller/service code while still giving the frontend instant updates.

## Data Flow

1. Community page loads rooms and selected feed as it does today.
2. Chat panel requests recent messages for the selected room slug.
3. Browser opens SignalR connection with the JWT token and joins the selected room group.
4. User submits a message through `POST /api/chat/rooms/{slug}/messages`.
5. Backend saves the message and broadcasts `RoomMessageCreated` to the SignalR group.
6. Frontend appends the broadcast message without a page refresh.

## UI

The current right-column "Chat" box becomes room chat. It shows the active room name, a scrollable message list, timestamps, callsigns and a compact input. The contacts/private-message card can stay below or be removed later, but the first implementation prioritizes room chat.

## Validation And Safety

Messages are trimmed, limited to 1000 characters and require authentication. Room slug must exist except `alle`, which maps to a global community chat. Server timestamps are UTC.

## Testing

Backend tests cover:

- creating a room message stores it with the authenticated user and room;
- loading room history returns messages in chronological order;
- invalid room slugs are rejected;
- empty messages are rejected.

Frontend is verified with lint and local HTTP/browser smoke checks.
