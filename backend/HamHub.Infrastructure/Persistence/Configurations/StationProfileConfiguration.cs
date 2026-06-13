using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamHub.Infrastructure.Persistence.Configurations;

public class StationProfileConfiguration : IEntityTypeConfiguration<StationProfile>
{
    public void Configure(EntityTypeBuilder<StationProfile> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Name).HasMaxLength(200).IsRequired();
        builder.Property(s => s.Callsign).HasMaxLength(20);
        builder.Property(s => s.GridLocator).HasMaxLength(10);

        var modesComparer = new ValueComparer<List<Mode>>(
            (a, b) => a != null && b != null && a.SequenceEqual(b),
            v => v.Aggregate(0, (a, b) => HashCode.Combine(a, b.GetHashCode())),
            v => v.ToList());

        var bandsComparer = new ValueComparer<List<Band>>(
            (a, b) => a != null && b != null && a.SequenceEqual(b),
            v => v.Aggregate(0, (a, b) => HashCode.Combine(a, b.GetHashCode())),
            v => v.ToList());

        builder.Property(s => s.SupportedModes)
            .HasConversion(
                v => string.Join(',', v.Select(m => (int)m)),
                v => v.Split(',', StringSplitOptions.RemoveEmptyEntries)
                       .Select(x => (Mode)int.Parse(x)).ToList())
            .Metadata.SetValueComparer(modesComparer);

        builder.Property(s => s.SupportedBands)
            .HasConversion(
                v => string.Join(',', v.Select(b => (int)b)),
                v => v.Split(',', StringSplitOptions.RemoveEmptyEntries)
                       .Select(x => (Band)int.Parse(x)).ToList())
            .Metadata.SetValueComparer(bandsComparer);

        builder.HasOne(s => s.User)
            .WithMany(u => u.Stations)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.UserId);
    }
}
