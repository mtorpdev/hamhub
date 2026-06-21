using System.Text;
using Microsoft.AspNetCore.RateLimiting;
using HamHub.Application;
using HamHub.Api.Hubs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure;
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Persistence.Seeders;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
var dataProtectionBuilder = builder.Services
    .AddDataProtection()
    .SetApplicationName("HamHub");
if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    Directory.CreateDirectory(dataProtectionKeysPath);
    dataProtectionBuilder.PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));
    Console.WriteLine($"Data Protection keys are persisted to {dataProtectionKeysPath}");
}
else if (builder.Environment.IsProduction())
{
    Console.WriteLine("WARNING: DataProtection:KeysPath is not configured in production. Encrypted integration credentials may become unreadable after deploys.");
}

builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "HamHub API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

var jwtSecret = builder.Configuration["JwtSettings:Secret"] ?? "HamHub-Super-Secret-Key-MinLength-32-Chars!";
builder.Services.AddAuthentication(options =>
{
    // AddIdentity sets DefaultChallengeScheme to cookie (→ redirect to /Account/Login).
    // Override both so API endpoints return 401 instead of redirecting.
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    (path.StartsWithSegments("/hubs/community-chat") || path.StartsWithSegments("/hubs/private-messages")))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("qrz-lookup", o =>
    {
        o.Window = TimeSpan.FromMinutes(1);
        o.PermitLimit = 30;
        o.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
        o.QueueLimit = 0;
    });
});


builder.Services.AddSingleton<HamHub.Api.Services.WsjtxBroadcaster>();
builder.Services.AddSingleton<HamHub.Api.Services.WsjtxCommandQueue>();
builder.Services.AddSingleton<HamHub.Api.Services.WsjtxStatusCache>();
builder.Services.AddSingleton<HamHub.Api.Services.WsjtxAgentPresenceCache>();
builder.Services.AddSingleton<HamHub.Api.Services.CommunityPresenceTracker>();
builder.Services.AddSingleton<HamHub.Api.Services.DxClusterSpotService>();
builder.Services.AddSingleton<HamHub.Api.Services.DxccLookupService>();
builder.Services.AddScoped<HamHub.Api.Services.Awards.AwardEngine>();
builder.Services.AddScoped<HamHub.Api.Services.QsoAwardEnrichmentService>();
builder.Services.AddHttpClient<HamHub.Api.Services.OpenMeteoWeatherService>();
builder.Services.AddHttpClient<HamHub.Api.Services.NoaaSwpcPropagationService>();
builder.Services.AddHttpClient<HamHub.Api.Services.Kc2gMufFof2Service>();
builder.Services.AddHttpClient<HamHub.Api.Services.PotaClient>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("HamHub/1.0 (+https://hamhub.dk)");
});
builder.Services.AddHttpClient<HamHub.Api.Services.ArticleFeedImportService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("HamHub/1.0 (+https://hamhub.dk)");
});
builder.Services.AddHostedService<HamHub.Api.Services.WsjtxPruneService>();
builder.Services.AddHostedService<HamHub.Api.Services.ArticleFeedImportHostedService>();
builder.Services.AddSingleton<HamHub.Api.Services.IQrzSyncTrigger, HamHub.Api.Services.QrzSyncTrigger>();
builder.Services.AddHostedService<HamHub.Api.Services.QrzSyncService>();
builder.Services.AddScoped<HamHub.Api.Services.LotwSyncService>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var allowedOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>()
            ?? new[] { "http://localhost:3000", "https://localhost:3000" };
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseRateLimiter();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<CommunityChatHub>("/hubs/community-chat");
app.MapHub<PrivateMessagesHub>("/hubs/private-messages");

// Ensure upload directories exist
var uploadsRoot = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads");
Directory.CreateDirectory(Path.Combine(uploadsRoot, "listings"));
Directory.CreateDirectory(Path.Combine(uploadsRoot, "posts"));
Directory.CreateDirectory(Path.Combine(uploadsRoot, "stations"));

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

    await context.Database.EnsureCreatedAsync();
    await TryEnsureSchemaAsync("community", () => EnsureCommunitySchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("chat", () => EnsureChatSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("friendships", () => EnsureFriendshipSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("safety", () => EnsureSafetySchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("article feed", () => EnsureArticleFeedSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("forum moderation", () => EnsureForumModerationSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("QSO external status", () => EnsureQsoExternalStatusSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("LoTW integration", () => EnsureLotwSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("award fields", () => EnsureAwardFieldsSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("WSJT-X timing", () => EnsureWsjtxTimingSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("notifications", () => EnsureNotificationSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("station media", () => EnsureStationMediaSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("default station", () => EnsureDefaultStationSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("preferred language", () => EnsurePreferredLanguageSchemaAsync(context), app.Logger);
    await TryEnsureSchemaAsync("QSO analyses", () => EnsureQsoAnalysisSchemaAsync(context), app.Logger);
    await DataSeeder.SeedAsync(context, userManager, roleManager);
    await TryRunStartupTaskAsync("QSO award enrichment backfill", async () =>
    {
        var backfill = scope.ServiceProvider.GetRequiredService<HamHub.Api.Services.QsoAwardEnrichmentService>();
        var result = await backfill.BackfillMissingAsync();
        app.Logger.LogInformation("QSO award enrichment backfill scanned {Scanned} QSOs and updated {Updated}.", result.Scanned, result.Updated);
    }, app.Logger);

    var importer = scope.ServiceProvider.GetRequiredService<HamHub.Api.Services.ArticleFeedImportService>();
    await importer.ImportAsync();
}

app.Run();

static async Task TryEnsureSchemaAsync(string schemaName, Func<Task> ensureSchema, ILogger logger)
{
    try
    {
        await ensureSchema();
    }
    catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.InsufficientPrivilege)
    {
        logger.LogWarning("Skipping {SchemaName} schema guard because the configured database user does not have DDL privileges.", schemaName);
    }
}

static async Task TryRunStartupTaskAsync(string taskName, Func<Task> runTask, ILogger logger)
{
    try
    {
        await runTask();
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Startup task {TaskName} failed.", taskName);
    }
}

static async Task EnsureCommunitySchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "CommunityRooms" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "Name" text NOT NULL,
            "Slug" text NOT NULL,
            "Description" text,
            "SortOrder" integer NOT NULL DEFAULT 0,
            "IsSystem" boolean NOT NULL DEFAULT true,
            "IsArchived" boolean NOT NULL DEFAULT false,
            "OwnerId" text,
            "Visibility" integer NOT NULL DEFAULT 1,
            "AllowJoinRequests" boolean NOT NULL DEFAULT true,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            CONSTRAINT "PK_CommunityRooms" PRIMARY KEY ("Id")
        );

        ALTER TABLE "CommunityRooms"
        ADD COLUMN IF NOT EXISTS "OwnerId" text,
        ADD COLUMN IF NOT EXISTS "Visibility" integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "AllowJoinRequests" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "IsArchived" boolean NOT NULL DEFAULT false;

        ALTER TABLE "Posts"
        ADD COLUMN IF NOT EXISTS "CommunityRoomId" integer;
        ALTER TABLE "Posts"
        ADD COLUMN IF NOT EXISTS "Title" character varying(160);
        ALTER TABLE "Posts"
        ADD COLUMN IF NOT EXISTS "Tags" character varying(300);
        ALTER TABLE "Posts"
        ADD COLUMN IF NOT EXISTS "IsSolved" boolean NOT NULL DEFAULT false;

        CREATE UNIQUE INDEX IF NOT EXISTS "IX_CommunityRooms_Slug" ON "CommunityRooms" ("Slug");
        CREATE INDEX IF NOT EXISTS "IX_CommunityRooms_OwnerId" ON "CommunityRooms" ("OwnerId");
        CREATE INDEX IF NOT EXISTS "IX_CommunityRooms_IsArchived_Visibility" ON "CommunityRooms" ("IsArchived", "Visibility");
        CREATE INDEX IF NOT EXISTS "IX_Posts_CommunityRoomId" ON "Posts" ("CommunityRoomId");
        CREATE INDEX IF NOT EXISTS "IX_Posts_IsSolved_CreatedAt" ON "Posts" ("IsSolved", "CreatedAt");

        CREATE TABLE IF NOT EXISTS "CommunityGroupMemberships" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "CommunityRoomId" integer NOT NULL,
            "UserId" text NOT NULL,
            "Role" integer NOT NULL DEFAULT 3,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            CONSTRAINT "PK_CommunityGroupMemberships" PRIMARY KEY ("Id")
        );

        CREATE TABLE IF NOT EXISTS "CommunityGroupJoinRequests" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "CommunityRoomId" integer NOT NULL,
            "UserId" text NOT NULL,
            "Status" integer NOT NULL DEFAULT 1,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            "ResolvedAt" timestamp with time zone,
            CONSTRAINT "PK_CommunityGroupJoinRequests" PRIMARY KEY ("Id")
        );

        CREATE TABLE IF NOT EXISTS "CommunityGroupInvitations" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "CommunityRoomId" integer NOT NULL,
            "InviterId" text NOT NULL,
            "InviteeId" text NOT NULL,
            "Status" integer NOT NULL DEFAULT 1,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            "ResolvedAt" timestamp with time zone,
            CONSTRAINT "PK_CommunityGroupInvitations" PRIMARY KEY ("Id")
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "IX_CommunityGroupMemberships_CommunityRoomId_UserId"
            ON "CommunityGroupMemberships" ("CommunityRoomId", "UserId");
        CREATE INDEX IF NOT EXISTS "IX_CommunityGroupJoinRequests_CommunityRoomId_UserId_Status"
            ON "CommunityGroupJoinRequests" ("CommunityRoomId", "UserId", "Status");
        CREATE INDEX IF NOT EXISTS "IX_CommunityGroupInvitations_CommunityRoomId_InviteeId_Status"
            ON "CommunityGroupInvitations" ("CommunityRoomId", "InviteeId", "Status");

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_CommunityRooms_AspNetUsers_OwnerId'
            ) THEN
                ALTER TABLE "CommunityRooms"
                ADD CONSTRAINT "FK_CommunityRooms_AspNetUsers_OwnerId"
                FOREIGN KEY ("OwnerId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE SET NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_Posts_CommunityRooms_CommunityRoomId'
            ) THEN
                ALTER TABLE "Posts"
                ADD CONSTRAINT "FK_Posts_CommunityRooms_CommunityRoomId"
                FOREIGN KEY ("CommunityRoomId") REFERENCES "CommunityRooms" ("Id")
                ON DELETE SET NULL;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CommunityGroupMemberships_CommunityRooms_CommunityRoomId') THEN
                ALTER TABLE "CommunityGroupMemberships"
                ADD CONSTRAINT "FK_CommunityGroupMemberships_CommunityRooms_CommunityRoomId"
                FOREIGN KEY ("CommunityRoomId") REFERENCES "CommunityRooms" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CommunityGroupMemberships_AspNetUsers_UserId') THEN
                ALTER TABLE "CommunityGroupMemberships"
                ADD CONSTRAINT "FK_CommunityGroupMemberships_AspNetUsers_UserId"
                FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CommunityGroupJoinRequests_CommunityRooms_CommunityRoomId') THEN
                ALTER TABLE "CommunityGroupJoinRequests"
                ADD CONSTRAINT "FK_CommunityGroupJoinRequests_CommunityRooms_CommunityRoomId"
                FOREIGN KEY ("CommunityRoomId") REFERENCES "CommunityRooms" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CommunityGroupJoinRequests_AspNetUsers_UserId') THEN
                ALTER TABLE "CommunityGroupJoinRequests"
                ADD CONSTRAINT "FK_CommunityGroupJoinRequests_AspNetUsers_UserId"
                FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CommunityGroupInvitations_CommunityRooms_CommunityRoomId') THEN
                ALTER TABLE "CommunityGroupInvitations"
                ADD CONSTRAINT "FK_CommunityGroupInvitations_CommunityRooms_CommunityRoomId"
                FOREIGN KEY ("CommunityRoomId") REFERENCES "CommunityRooms" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CommunityGroupInvitations_AspNetUsers_InviterId') THEN
                ALTER TABLE "CommunityGroupInvitations"
                ADD CONSTRAINT "FK_CommunityGroupInvitations_AspNetUsers_InviterId"
                FOREIGN KEY ("InviterId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CommunityGroupInvitations_AspNetUsers_InviteeId') THEN
                ALTER TABLE "CommunityGroupInvitations"
                ADD CONSTRAINT "FK_CommunityGroupInvitations_AspNetUsers_InviteeId"
                FOREIGN KEY ("InviteeId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;
        END $$;
        """);
}

static async Task EnsureChatSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "ChatMessages" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "UserId" text NOT NULL,
            "CommunityRoomId" integer,
            "Content" character varying(1000) NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            CONSTRAINT "PK_ChatMessages" PRIMARY KEY ("Id")
        );

        CREATE INDEX IF NOT EXISTS "IX_ChatMessages_CommunityRoomId_CreatedAt"
            ON "ChatMessages" ("CommunityRoomId", "CreatedAt");
        CREATE INDEX IF NOT EXISTS "IX_ChatMessages_UserId"
            ON "ChatMessages" ("UserId");

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_ChatMessages_AspNetUsers_UserId'
            ) THEN
                ALTER TABLE "ChatMessages"
                ADD CONSTRAINT "FK_ChatMessages_AspNetUsers_UserId"
                FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_ChatMessages_CommunityRooms_CommunityRoomId'
            ) THEN
                ALTER TABLE "ChatMessages"
                ADD CONSTRAINT "FK_ChatMessages_CommunityRooms_CommunityRoomId"
                FOREIGN KEY ("CommunityRoomId") REFERENCES "CommunityRooms" ("Id")
                ON DELETE SET NULL;
            END IF;
        END $$;
        """);
}

static async Task EnsureFriendshipSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "Friendships" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "RequesterId" text NOT NULL,
            "AddresseeId" text NOT NULL,
            "Status" integer NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            "RespondedAt" timestamp with time zone,
            CONSTRAINT "PK_Friendships" PRIMARY KEY ("Id")
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Friendships_RequesterId_AddresseeId"
            ON "Friendships" ("RequesterId", "AddresseeId");
        CREATE INDEX IF NOT EXISTS "IX_Friendships_AddresseeId_RequesterId"
            ON "Friendships" ("AddresseeId", "RequesterId");

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_Friendships_AspNetUsers_RequesterId'
            ) THEN
                ALTER TABLE "Friendships"
                ADD CONSTRAINT "FK_Friendships_AspNetUsers_RequesterId"
                FOREIGN KEY ("RequesterId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_Friendships_AspNetUsers_AddresseeId'
            ) THEN
                ALTER TABLE "Friendships"
                ADD CONSTRAINT "FK_Friendships_AspNetUsers_AddresseeId"
                FOREIGN KEY ("AddresseeId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;
        END $$;
        """);
}

static async Task EnsureArticleFeedSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "Articles"
        ADD COLUMN IF NOT EXISTS "SourceName" character varying(200),
        ADD COLUMN IF NOT EXISTS "SourceUrl" character varying(1000),
        ADD COLUMN IF NOT EXISTS "OriginalUrl" character varying(1000),
        ADD COLUMN IF NOT EXISTS "FeedGuid" character varying(1000),
        ADD COLUMN IF NOT EXISTS "ImportedAt" timestamp with time zone;

        CREATE INDEX IF NOT EXISTS "IX_Articles_FeedGuid" ON "Articles" ("FeedGuid");
        CREATE INDEX IF NOT EXISTS "IX_Articles_OriginalUrl" ON "Articles" ("OriginalUrl");
        """);
}

static async Task EnsureQsoExternalStatusSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "QsoEntries"
        ADD COLUMN IF NOT EXISTS "QrzConfirmationStatus" character varying(1),
        ADD COLUMN IF NOT EXISTS "QrzConfirmedAt" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "QrzQslDate" timestamp with time zone;
        """);
}

static async Task EnsureForumModerationSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "Posts"
        ADD COLUMN IF NOT EXISTS "IsPinned" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "IsLocked" boolean NOT NULL DEFAULT false;

        CREATE INDEX IF NOT EXISTS "IX_Posts_IsPinned_UpdatedAt"
            ON "Posts" ("IsPinned", "UpdatedAt");
        """);
}

static async Task EnsureLotwSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "AspNetUsers"
        ADD COLUMN IF NOT EXISTS "LotwUsername" character varying(50),
        ADD COLUMN IF NOT EXISTS "LotwPassword" text,
        ADD COLUMN IF NOT EXISTS "LotwLastSyncedAt" timestamp with time zone;

        ALTER TABLE "QsoEntries"
        ADD COLUMN IF NOT EXISTS "LotwConfirmedAt" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "LotwQslDate" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "LotwLastResult" character varying(500);
        """);
}

static async Task EnsureAwardFieldsSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "QsoEntries"
        ADD COLUMN IF NOT EXISTS "AwardRefs" character varying(512),
        ADD COLUMN IF NOT EXISTS "County" character varying(128),
        ADD COLUMN IF NOT EXISTS "CqZone" integer,
        ADD COLUMN IF NOT EXISTS "ItuZone" integer,
        ADD COLUMN IF NOT EXISTS "MyCounty" character varying(128),
        ADD COLUMN IF NOT EXISTS "MyState" character varying(128),
        ADD COLUMN IF NOT EXISTS "PotaRefs" character varying(512),
        ADD COLUMN IF NOT EXISTS "SotaRefs" character varying(512);
        """);
}

static async Task EnsureWsjtxTimingSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "WsjtxDecodes"
        ADD COLUMN IF NOT EXISTS "ServerReceivedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW();

        CREATE INDEX IF NOT EXISTS "IX_WsjtxDecodes_ServerReceivedAtUtc"
            ON "WsjtxDecodes" ("ServerReceivedAtUtc");
        """);
}

static async Task EnsureSafetySchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "UserBlocks" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "BlockerId" text NOT NULL,
            "BlockedId" text NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            CONSTRAINT "PK_UserBlocks" PRIMARY KEY ("Id")
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "IX_UserBlocks_BlockerId_BlockedId"
            ON "UserBlocks" ("BlockerId", "BlockedId");

        CREATE TABLE IF NOT EXISTS "ContentReports" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "ReporterId" text NOT NULL,
            "TargetType" character varying(50) NOT NULL,
            "TargetUserId" text,
            "TargetId" integer,
            "Reason" character varying(1000) NOT NULL,
            "Status" integer NOT NULL DEFAULT 1,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            "ResolvedAt" timestamp with time zone,
            CONSTRAINT "PK_ContentReports" PRIMARY KEY ("Id")
        );

        CREATE INDEX IF NOT EXISTS "IX_ContentReports_Status_CreatedAt"
            ON "ContentReports" ("Status", "CreatedAt");
        CREATE INDEX IF NOT EXISTS "IX_ContentReports_ReporterId"
            ON "ContentReports" ("ReporterId");
        CREATE INDEX IF NOT EXISTS "IX_ContentReports_TargetUserId"
            ON "ContentReports" ("TargetUserId");

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_UserBlocks_AspNetUsers_BlockerId') THEN
                ALTER TABLE "UserBlocks"
                ADD CONSTRAINT "FK_UserBlocks_AspNetUsers_BlockerId"
                FOREIGN KEY ("BlockerId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_UserBlocks_AspNetUsers_BlockedId') THEN
                ALTER TABLE "UserBlocks"
                ADD CONSTRAINT "FK_UserBlocks_AspNetUsers_BlockedId"
                FOREIGN KEY ("BlockedId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ContentReports_AspNetUsers_ReporterId') THEN
                ALTER TABLE "ContentReports"
                ADD CONSTRAINT "FK_ContentReports_AspNetUsers_ReporterId"
                FOREIGN KEY ("ReporterId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ContentReports_AspNetUsers_TargetUserId') THEN
                ALTER TABLE "ContentReports"
                ADD CONSTRAINT "FK_ContentReports_AspNetUsers_TargetUserId"
                FOREIGN KEY ("TargetUserId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE SET NULL;
            END IF;
        END $$;
        """);
}

static async Task EnsureNotificationSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "NotificationEvents" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "UserId" text NOT NULL,
            "Type" character varying(50) NOT NULL,
            "Title" character varying(200) NOT NULL,
            "Description" character varying(1000) NOT NULL,
            "Href" character varying(500) NOT NULL,
            "RelatedId" integer,
            "GroupId" integer,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            "ReadAt" timestamp with time zone,
            CONSTRAINT "PK_NotificationEvents" PRIMARY KEY ("Id")
        );

        CREATE INDEX IF NOT EXISTS "IX_NotificationEvents_UserId_ReadAt_CreatedAt"
            ON "NotificationEvents" ("UserId", "ReadAt", "CreatedAt");

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_NotificationEvents_AspNetUsers_UserId'
            ) THEN
                ALTER TABLE "NotificationEvents"
                ADD CONSTRAINT "FK_NotificationEvents_AspNetUsers_UserId"
                FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id")
                ON DELETE CASCADE;
            END IF;
        END $$;
        """);
}

static async Task EnsureStationMediaSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "StationProfiles"
            ADD COLUMN IF NOT EXISTS "StationType" integer NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS "Description" character varying(2000),
            ADD COLUMN IF NOT EXISTS "Visibility" integer NOT NULL DEFAULT 3;

        CREATE TABLE IF NOT EXISTS "StationImages" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "StationProfileId" integer NOT NULL,
            "FileName" text NOT NULL,
            "Order" integer NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            CONSTRAINT "PK_StationImages" PRIMARY KEY ("Id")
        );

        CREATE INDEX IF NOT EXISTS "IX_StationImages_StationProfileId"
            ON "StationImages" ("StationProfileId");

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_StationImages_StationProfiles_StationProfileId'
            ) THEN
                ALTER TABLE "StationImages"
                ADD CONSTRAINT "FK_StationImages_StationProfiles_StationProfileId"
                FOREIGN KEY ("StationProfileId") REFERENCES "StationProfiles" ("Id")
                ON DELETE CASCADE;
            END IF;
        END $$;
        """);
}

static async Task EnsureDefaultStationSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "AspNetUsers"
        ADD COLUMN IF NOT EXISTS "DefaultStationId" integer;

        CREATE INDEX IF NOT EXISTS "IX_AspNetUsers_DefaultStationId"
            ON "AspNetUsers" ("DefaultStationId");
        """);
}

static async Task EnsurePreferredLanguageSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "AspNetUsers"
        ADD COLUMN IF NOT EXISTS "PreferredLanguage" character varying(5);
        """);
}

static async Task EnsureQsoAnalysisSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "QsoAnalyses" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "QsoId" integer NOT NULL,
            "UserId" text NOT NULL,
            "GeneratedAtUtc" timestamp with time zone NOT NULL,
            "AnalysisVersion" integer NOT NULL,
            "InputHash" character varying(128) NOT NULL,
            "OverallScore" integer NOT NULL,
            "ConfirmationScore" integer NOT NULL,
            "DataQualityScore" integer NOT NULL,
            "AwardImpactScore" integer NOT NULL,
            "PropagationScore" integer NOT NULL,
            "DuplicateRiskScore" integer NOT NULL,
            "FlagsJson" text NOT NULL,
            "HighlightsJson" text NOT NULL,
            "MissingDataJson" text NOT NULL,
            "AwardImpactJson" text NOT NULL,
            "QslJson" text NOT NULL,
            "PropagationJson" text NOT NULL,
            "SunJson" text NOT NULL,
            "WeatherJson" text NOT NULL,
            "DuplicateRiskJson" text NOT NULL,
            "StoryText" character varying(4000) NOT NULL,
            CONSTRAINT "PK_QsoAnalyses" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_QsoAnalyses_QsoEntries_QsoId" FOREIGN KEY ("QsoId") REFERENCES "QsoEntries" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_QsoAnalyses_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "IX_QsoAnalyses_QsoId" ON "QsoAnalyses" ("QsoId");
        CREATE INDEX IF NOT EXISTS "IX_QsoAnalyses_UserId_GeneratedAtUtc" ON "QsoAnalyses" ("UserId", "GeneratedAtUtc");
        CREATE INDEX IF NOT EXISTS "IX_QsoAnalyses_UserId_OverallScore" ON "QsoAnalyses" ("UserId", "OverallScore");
        CREATE INDEX IF NOT EXISTS "IX_QsoAnalyses_UserId_DataQualityScore" ON "QsoAnalyses" ("UserId", "DataQualityScore");
        """);
}
