using HamHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamHub.Infrastructure.Persistence.Configurations;

public class QsoAnalysisConfiguration : IEntityTypeConfiguration<QsoAnalysis>
{
    public void Configure(EntityTypeBuilder<QsoAnalysis> builder)
    {
        builder.HasKey(a => a.Id);

        builder.HasIndex(a => a.QsoId)
            .IsUnique();
        builder.HasIndex(a => new { a.UserId, a.GeneratedAtUtc });
        builder.HasIndex(a => new { a.UserId, a.OverallScore });
        builder.HasIndex(a => new { a.UserId, a.DataQualityScore });

        builder.Property(a => a.InputHash)
            .HasMaxLength(128)
            .IsRequired();
        builder.Property(a => a.StoryText)
            .HasMaxLength(4000)
            .IsRequired();

        builder.HasOne(a => a.Qso)
            .WithOne(q => q.Analysis)
            .HasForeignKey<QsoAnalysis>(a => a.QsoId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
