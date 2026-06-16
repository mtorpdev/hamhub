# Community Layout Design

## Goal

Build the Community page as a HamHub-flavoured social workspace with a left rail for rooms/forums, a center feed, and a right rail for contacts and chat-like messaging.

## Selected Direction

Use layout option A from the visual brainstorm: similar spatial model to Facebook, but focused on amateur radio. The first version should not build realtime chat or presence. It should use the existing message system as a chat-like panel and leave SignalR/live presence for a later iteration.

## User Experience

The `/community` page uses three desktop columns:

- Left: "Mine sider og fora" with radio-focused rooms such as Alle opslag, DX, FT8/FT4, Teknik, Køb/salg, Lokale klubber, and QSO historier.
- Center: existing post composer and feed, filtered by selected room. Posts can be created in the selected room.
- Right: contacts and latest messages. A user can pick a member/contact and send a short message without leaving Community.

On mobile, the page collapses to one column. The room selector becomes a horizontal scroll area above the feed, and contacts/messages appear below the feed.

## Backend

Add a `CommunityRoom` entity and a nullable `CommunityRoomId` on `Post`. Existing posts without a room remain visible under "Alle opslag". Default system rooms are seeded automatically.

Posts API changes:

- `GET /api/posts?page=1&room=dx` filters posts by room slug when `room` is supplied.
- `POST /api/posts` accepts `roomSlug` and stores the matching room id.
- Post DTOs include `communityRoomId`, `communityRoomSlug`, and `communityRoomName`.
- `GET /api/community/rooms` returns available rooms.

Messaging remains backed by `MessagesController`. The first UI uses `users.getAll`, `messages.getInbox`, and `messages.send`.

## Data Safety

The database change must be additive:

- Create `CommunityRooms`.
- Add nullable `CommunityRoomId` to `Posts`.
- Existing posts stay valid.
- Program startup applies a minimal schema guard for deployed databases that currently use `EnsureCreatedAsync` plus manual schema patching.

## Testing

Backend tests cover:

- room filtering returns only posts for the requested slug.
- post creation maps a valid room slug onto `CommunityRoomId`.

Frontend verification covers:

- `npm.cmd run build`
- `/community` layout compiles with the new types and API calls.

