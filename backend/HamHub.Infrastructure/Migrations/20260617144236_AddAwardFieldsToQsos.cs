using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAwardFieldsToQsos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AwardRefs",
                table: "QsoEntries",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "County",
                table: "QsoEntries",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CqZone",
                table: "QsoEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ItuZone",
                table: "QsoEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MyCounty",
                table: "QsoEntries",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MyState",
                table: "QsoEntries",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PotaRefs",
                table: "QsoEntries",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SotaRefs",
                table: "QsoEntries",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AwardRefs",
                table: "QsoEntries");

            migrationBuilder.DropColumn(
                name: "County",
                table: "QsoEntries");

            migrationBuilder.DropColumn(
                name: "CqZone",
                table: "QsoEntries");

            migrationBuilder.DropColumn(
                name: "ItuZone",
                table: "QsoEntries");

            migrationBuilder.DropColumn(
                name: "MyCounty",
                table: "QsoEntries");

            migrationBuilder.DropColumn(
                name: "MyState",
                table: "QsoEntries");

            migrationBuilder.DropColumn(
                name: "PotaRefs",
                table: "QsoEntries");

            migrationBuilder.DropColumn(
                name: "SotaRefs",
                table: "QsoEntries");
        }
    }
}
