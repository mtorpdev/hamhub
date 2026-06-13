using HamHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamHub.Infrastructure.Persistence.Configurations;

public class WsjtxDecodeConfiguration : IEntityTypeConfiguration<WsjtxDecode>
{
    public void Configure(EntityTypeBuilder<WsjtxDecode> builder)
    {
        builder.HasKey(d => d.Id);
        builder.Property(d => d.UserId).HasMaxLength(450).IsRequired();
        builder.Property(d => d.SpotterCallsign).HasMaxLength(20).IsRequired();
        builder.Property(d => d.Message).HasMaxLength(30).IsRequired();
        builder.Property(d => d.DxCallsign).HasMaxLength(20);
        builder.Property(d => d.DxGrid).HasMaxLength(10);
        builder.Property(d => d.Mode).HasMaxLength(10).IsRequired();

        builder.HasOne(d => d.User)
            .WithMany()
            .HasForeignKey(d => d.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => d.DecodedAt);
    }
}
