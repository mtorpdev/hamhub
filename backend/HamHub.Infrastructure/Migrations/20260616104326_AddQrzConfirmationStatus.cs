using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQrzConfirmationStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "QrzConfirmationStatus",
                table: "QsoEntries",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "QrzConfirmedAt",
                table: "QsoEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "QrzQslDate",
                table: "QsoEntries",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QrzConfirmationStatus",
                table: "QsoEntries");

            migrationBuilder.DropColumn(
                name: "QrzConfirmedAt",
                table: "QsoEntries");

            migrationBuilder.DropColumn(
                name: "QrzQslDate",
                table: "QsoEntries");
        }
    }
}
