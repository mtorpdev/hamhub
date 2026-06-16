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
    public DbSet<Listing> Listings => Set<Listing>();
    public DbSet<ListingImage> ListingImages => Set<ListingImage>();
    public DbSet<CommunityRoom> CommunityRooms => Set<CommunityRoom>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<PostImage> PostImages => Set<PostImage>();
    public DbSet<PostLike> PostLikes => Set<PostLike>();
    public DbSet<PostComment> PostComments => Set<PostComment>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Composite PK for PostLike (no surrogate key)
        builder.Entity<PostLike>().HasKey(pl => new { pl.PostId, pl.UserId });

        builder.Entity<CommunityRoom>()
            .HasIndex(r => r.Slug)
            .IsUnique();

        builder.Entity<Post>()
            .HasIndex(p => p.CommunityRoomId);

        builder.Entity<Post>()
            .HasOne(p => p.CommunityRoom)
            .WithMany(r => r.Posts)
            .HasForeignKey(p => p.CommunityRoomId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<ChatMessage>()
            .HasIndex(m => new { m.CommunityRoomId, m.CreatedAt });

        builder.Entity<ChatMessage>()
            .Property(m => m.Content)
            .HasMaxLength(1000);

        builder.Entity<ChatMessage>()
            .HasOne(m => m.CommunityRoom)
            .WithMany(r => r.ChatMessages)
            .HasForeignKey(m => m.CommunityRoomId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<ChatMessage>()
            .HasOne(m => m.User)
            .WithMany(u => u.ChatMessages)
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
