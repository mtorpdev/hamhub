using System.Text;
using Microsoft.AspNetCore.RateLimiting;
using HamHub.Application;
using HamHub.Domain.Entities;
using HamHub.Infrastructure;
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Persistence.Seeders;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddControllers();
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
    await EnsureArticleFeedSchemaAsync(context);
    await DataSeeder.SeedAsync(context, userManager, roleManager);

    var importer = scope.ServiceProvider.GetRequiredService<HamHub.Api.Services.ArticleFeedImportService>();
    await importer.ImportAsync();
}

app.Run();

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
