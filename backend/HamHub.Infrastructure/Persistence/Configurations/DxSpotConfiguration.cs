using HamHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamHub.Infrastructure.Persistence.Configurations;

public class DxSpotConfiguration : IEntityTypeConfiguration<DxSpot>
{
    public void Configure(EntityTypeBuilder<DxSpot> builder)
    {
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Callsign).HasMaxLength(20).IsRequired();
        builder.Property(d => d.Comment).HasMaxLength(500);

        builder.HasOne(d => d.User)
            .WithMany(u => u.DxSpots)
            .HasForeignKey(d => d.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => d.SpottedAt);
        builder.HasIndex(d => d.Callsign);
    }
}
