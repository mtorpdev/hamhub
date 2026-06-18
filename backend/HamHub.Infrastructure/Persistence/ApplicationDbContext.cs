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
    public DbSet<CommunityGroupMembership> CommunityGroupMemberships => Set<CommunityGroupMembership>();
    public DbSet<CommunityGroupJoinRequest> CommunityGroupJoinRequests => Set<CommunityGroupJoinRequest>();
    public DbSet<CommunityGroupInvitation> CommunityGroupInvitations => Set<CommunityGroupInvitation>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<UserBlock> UserBlocks => Set<UserBlock>();
    public DbSet<ContentReport> ContentReports => Set<ContentReport>();
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

        builder.Entity<CommunityRoom>()
            .Property(r => r.Name)
            .HasMaxLength(120);

        builder.Entity<CommunityRoom>()
            .Property(r => r.Description)
            .HasMaxLength(500);

        builder.Entity<CommunityRoom>()
            .HasOne(r => r.Owner)
            .WithMany()
            .HasForeignKey(r => r.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<CommunityGroupMembership>()
            .HasIndex(m => new { m.CommunityRoomId, m.UserId })
            .IsUnique();

        builder.Entity<CommunityGroupMembership>()
            .HasOne(m => m.CommunityRoom)
            .WithMany(r => r.Memberships)
            .HasForeignKey(m => m.CommunityRoomId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<CommunityGroupMembership>()
            .HasOne(m => m.User)
            .WithMany()
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<CommunityGroupJoinRequest>()
            .HasIndex(r => new { r.CommunityRoomId, r.UserId, r.Status });

        builder.Entity<CommunityGroupJoinRequest>()
            .HasOne(r => r.CommunityRoom)
            .WithMany(g => g.JoinRequests)
            .HasForeignKey(r => r.CommunityRoomId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<CommunityGroupJoinRequest>()
            .HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<CommunityGroupInvitation>()
            .HasIndex(i => new { i.CommunityRoomId, i.InviteeId, i.Status });

        builder.Entity<CommunityGroupInvitation>()
            .HasOne(i => i.CommunityRoom)
            .WithMany(g => g.Invitations)
            .HasForeignKey(i => i.CommunityRoomId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<CommunityGroupInvitation>()
            .HasOne(i => i.Inviter)
            .WithMany()
            .HasForeignKey(i => i.InviterId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<CommunityGroupInvitation>()
            .HasOne(i => i.Invitee)
            .WithMany()
            .HasForeignKey(i => i.InviteeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Post>()
            .HasIndex(p => p.CommunityRoomId);

        builder.Entity<Post>()
            .Property(p => p.Title)
            .HasMaxLength(160);

        builder.Entity<Post>()
            .Property(p => p.Tags)
            .HasMaxLength(300);

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

        builder.Entity<Friendship>()
            .HasIndex(f => new { f.RequesterId, f.AddresseeId })
            .IsUnique();

        builder.Entity<Friendship>()
            .HasIndex(f => new { f.AddresseeId, f.RequesterId });

        builder.Entity<Friendship>()
            .HasOne(f => f.Requester)
            .WithMany(u => u.SentFriendRequests)
            .HasForeignKey(f => f.RequesterId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Friendship>()
            .HasOne(f => f.Addressee)
            .WithMany(u => u.ReceivedFriendRequests)
            .HasForeignKey(f => f.AddresseeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<UserBlock>()
            .HasIndex(b => new { b.BlockerId, b.BlockedId })
            .IsUnique();

        builder.Entity<UserBlock>()
            .HasOne(b => b.Blocker)
            .WithMany()
            .HasForeignKey(b => b.BlockerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<UserBlock>()
            .HasOne(b => b.Blocked)
            .WithMany()
            .HasForeignKey(b => b.BlockedId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<ContentReport>()
            .HasIndex(r => new { r.Status, r.CreatedAt });

        builder.Entity<ContentReport>()
            .Property(r => r.TargetType)
            .HasMaxLength(50);

        builder.Entity<ContentReport>()
            .Property(r => r.Reason)
            .HasMaxLength(1000);

        builder.Entity<ContentReport>()
            .HasOne(r => r.Reporter)
            .WithMany()
            .HasForeignKey(r => r.ReporterId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<ContentReport>()
            .HasOne(r => r.TargetUser)
            .WithMany()
            .HasForeignKey(r => r.TargetUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
