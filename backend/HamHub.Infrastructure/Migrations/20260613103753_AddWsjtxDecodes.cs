using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HamHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWsjtxDecodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WsjtxDecodes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    SpotterCallsign = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Message = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    DxCallsign = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    DxGrid = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Snr = table.Column<int>(type: "integer", nullable: false),
                    DeltaTime = table.Column<double>(type: "double precision", nullable: false),
                    DeltaFreqHz = table.Column<long>(type: "bigint", nullable: false),
                    FrequencyMhz = table.Column<double>(type: "double precision", nullable: false),
                    Mode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    DecodedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WsjtxDecodes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WsjtxDecodes_DecodedAt",
                table: "WsjtxDecodes",
                column: "DecodedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WsjtxDecodes");
        }
    }
}
