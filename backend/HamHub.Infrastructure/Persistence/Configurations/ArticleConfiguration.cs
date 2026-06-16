using HamHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamHub.Infrastructure.Persistence.Configurations;

public class ArticleConfiguration : IEntityTypeConfiguration<Article>
{
    public void Configure(EntityTypeBuilder<Article> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Title).HasMaxLength(300).IsRequired();
        builder.Property(a => a.Slug).HasMaxLength(300).IsRequired();
        builder.Property(a => a.Summary).HasMaxLength(1000);
        builder.Property(a => a.SourceName).HasMaxLength(200);
        builder.Property(a => a.SourceUrl).HasMaxLength(1000);
        builder.Property(a => a.OriginalUrl).HasMaxLength(1000);
        builder.Property(a => a.FeedGuid).HasMaxLength(1000);

        builder.HasOne(a => a.Category)
            .WithMany(c => c.Articles)
            .HasForeignKey(a => a.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.Author)
            .WithMany(u => u.Articles)
            .HasForeignKey(a => a.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => a.Slug).IsUnique();
        builder.HasIndex(a => a.FeedGuid);
        builder.HasIndex(a => a.OriginalUrl);
        builder.HasIndex(a => a.IsPublished);
    }
}
