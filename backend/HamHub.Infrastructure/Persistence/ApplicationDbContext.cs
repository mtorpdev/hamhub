using HamHub.Domain.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Infrastructure.Persistence;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<StationProfile> StationProfiles => Set<StationProfile>();
    public DbSet<QsoEntry> QsoEntries => Set<QsoEntry>();
    public DbSet<DxSpot> DxSpots => Set<DxSpot>();
    public DbSet<Article> Articles => Set<Article>();
    public DbSet<ArticleCategory> ArticleCategories => Set<ArticleCategory>();
    public DbSet<ArticleComment> ArticleComments => Set<ArticleComment>();
    public DbSet<WsjtxDecode> WsjtxDecodes => Set<WsjtxDecode>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
