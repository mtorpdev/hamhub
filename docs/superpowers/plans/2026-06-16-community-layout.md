# Community Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a HamHub community page with rooms/forums on the left, the post feed in the center, and contacts plus message-based chat on the right.

**Architecture:** Add a small `CommunityRoom` domain model and connect posts to rooms with a nullable foreign key. Expose room listing and room-filtered post APIs, then reshape the existing `/community` frontend into a responsive three-column layout that reuses existing posts and messages APIs.

**Tech Stack:** ASP.NET Core 8, EF Core/Npgsql, xUnit, Next.js 16, React 19, Tailwind classes already used by the app.

---

### Task 1: Backend Community Rooms

**Files:**
- Create: `backend/HamHub.Domain/Entities/CommunityRoom.cs`
- Modify: `backend/HamHub.Domain/Entities/Post.cs`
- Modify: `backend/HamHub.Infrastructure/Persistence/ApplicationDbContext.cs`
- Modify: `backend/HamHub.Infrastructure/Persistence/Seeders/DataSeeder.cs`
- Modify: `backend/HamHub.Api/Program.cs`
- Create: `backend/HamHub.Api/Controllers/CommunityController.cs`

- [ ] Add `CommunityRoom` with `Id`, `Name`, `Slug`, `Description`, `SortOrder`, `IsSystem`, `CreatedAt`, and `Posts`.
- [ ] Add nullable `CommunityRoomId` and `CommunityRoom` navigation to `Post`.
- [ ] Add `DbSet<CommunityRoom>` and indexes for room slug and post room id.
- [ ] Seed seven default system rooms.
- [ ] Add startup schema guard for the new table and nullable post column.
- [ ] Add `GET /api/community/rooms`.

### Task 2: Post Room Filtering

**Files:**
- Modify: `backend/HamHub.Api/Controllers/PostsController.cs`
- Test: `backend/HamHub.Api.Tests/PostsControllerCommunityRoomTests.cs`

- [ ] Write controller tests for filtering by room slug and creating a post in a room.
- [ ] Update `GET /api/posts` to accept `room`.
- [ ] Update `POST /api/posts` to accept `roomSlug`.
- [ ] Include room metadata in post DTOs.
- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj --filter PostsControllerCommunityRoomTests`.

### Task 3: Frontend API And Types

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] Add `CommunityRoom` type.
- [ ] Add room metadata fields to `Post`.
- [ ] Add `api.community.getRooms`.
- [ ] Update `api.posts.getFeed(page, roomSlug)` and `api.posts.create(content, roomSlug)`.

### Task 4: Community Three-Column UI

**Files:**
- Modify: `frontend/src/app/community/page.tsx`

- [ ] Load rooms, inbox messages, and users alongside feed data.
- [ ] Render left room rail on desktop and horizontal room selector on mobile.
- [ ] Keep composer and feed in the center column.
- [ ] Render right contacts/messages panel.
- [ ] Add a compact message composer that sends via `api.messages.send`.
- [ ] Preserve existing like, comment, image upload, and delete behaviour.

### Task 5: Verification And Commit

**Files:**
- All changed files

- [ ] Run `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj`.
- [ ] Run `dotnet build backend\HamHub.Api\HamHub.Api.csproj`.
- [ ] Run `npm.cmd run build` in `frontend`.
- [ ] Check `git diff --check`.
- [ ] Commit and push the implementation branch.

