using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWsjtxDecodeCommandMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "LowConfidence",
                table: "WsjtxDecodes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SpotterGrid",
                table: "WsjtxDecodes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WsjtxId",
                table: "WsjtxDecodes",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "WsjtxTimeMs",
                table: "WsjtxDecodes",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LowConfidence",
                table: "WsjtxDecodes");

            migrationBuilder.DropColumn(
                name: "SpotterGrid",
                table: "WsjtxDecodes");

            migrationBuilder.DropColumn(
                name: "WsjtxId",
                table: "WsjtxDecodes");

            migrationBuilder.DropColumn(
                name: "WsjtxTimeMs",
                table: "WsjtxDecodes");
        }
    }
}
