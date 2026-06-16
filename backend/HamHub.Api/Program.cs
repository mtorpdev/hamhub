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
builder.Services.AddSingleton<HamHub.Api.Services.CommunityPresenceTracker>();
builder.Services.AddSingleton<HamHub.Api.Services.DxClusterSpotService>();
builder.Services.AddHttpClient<HamHub.Api.Services.OpenMeteoWeatherService>();
builder.Services.AddHttpClient<HamHub.Api.Services.NoaaSwpcPropagationService>();
builder.Services.AddHttpClient<HamHub.Api.Services.Kc2gMufFof2Service>();
builder.Services.AddHttpClient<HamHub.Api.Services.ArticleFeedImportService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("HamHub/1.0 (+https://hamhub.dk)");
});
builder.Services.AddHostedService<HamHub.Api.Services.WsjtxPruneService>();
builder.Services.AddHostedService<HamHub.Api.Services.ArticleFeedImportHostedService>();
builder.Services.AddSingleton<HamHub.Api.Services.IQrzSyncTrigger, HamHub.Api.Services.QrzSyncTrigger>();
builder.Services.AddHostedService<HamHub.Api.Services.QrzSyncService>();

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

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

    await context.Database.EnsureCreatedAsync();
    await EnsureCommunitySchemaAsync(context);
    await EnsureChatSchemaAsync(context);
    await EnsureFriendshipSchemaAsync(context);
    await EnsureSafetySchemaAsync(context);
    await EnsureArticleFeedSchemaAsync(context);
    await EnsureQsoExternalStatusSchemaAsync(context);
    await DataSeeder.SeedAsync(context, userManager, roleManager);

    var importer = scope.ServiceProvider.GetRequiredService<HamHub.Api.Services.ArticleFeedImportService>();
    await importer.ImportAsync();
}

app.Run();

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
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            CONSTRAINT "PK_CommunityRooms" PRIMARY KEY ("Id")
        );

        ALTER TABLE "Posts"
        ADD COLUMN IF NOT EXISTS "CommunityRoomId" integer;

        CREATE UNIQUE INDEX IF NOT EXISTS "IX_CommunityRooms_Slug" ON "CommunityRooms" ("Slug");
        CREATE INDEX IF NOT EXISTS "IX_Posts_CommunityRoomId" ON "Posts" ("CommunityRoomId");

        DO $$
        BEGIN
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
