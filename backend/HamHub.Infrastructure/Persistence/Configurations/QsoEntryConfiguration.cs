using HamHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamHub.Infrastructure.Persistence.Configurations;

public class QsoEntryConfiguration : IEntityTypeConfiguration<QsoEntry>
{
    public void Configure(EntityTypeBuilder<QsoEntry> builder)
    {
        builder.HasKey(q => q.Id);
        builder.Property(q => q.OwnCallsign).HasMaxLength(20).IsRequired();
        builder.Property(q => q.WorkedCallsign).HasMaxLength(20).IsRequired();
        builder.Property(q => q.RstSent).HasMaxLength(10);
        builder.Property(q => q.RstReceived).HasMaxLength(10);
        builder.Property(q => q.Locator).HasMaxLength(10);
        builder.Property(q => q.Country).HasMaxLength(100);
        builder.Property(q => q.QrzId).HasMaxLength(30);

        builder.HasOne(q => q.User)
            .WithMany(u => u.QsoEntries)
            .HasForeignKey(q => q.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(q => q.UserId);
        builder.HasIndex(q => q.WorkedCallsign);
        builder.HasIndex(q => q.DateUtc);

        // Partial index for fast unsynced-QSO scan (used by QrzSyncService)
        builder.HasIndex(q => q.UserId)
            .HasFilter("\"QrzId\" IS NULL")
            .HasDatabaseName("IX_QsoEntries_UserId_Unsynced");
    }
}
