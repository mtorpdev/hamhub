using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HamHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQsoAnalyses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QsoAnalyses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    QsoId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    GeneratedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AnalysisVersion = table.Column<int>(type: "integer", nullable: false),
                    InputHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    OverallScore = table.Column<int>(type: "integer", nullable: false),
                    ConfirmationScore = table.Column<int>(type: "integer", nullable: false),
                    DataQualityScore = table.Column<int>(type: "integer", nullable: false),
                    AwardImpactScore = table.Column<int>(type: "integer", nullable: false),
                    PropagationScore = table.Column<int>(type: "integer", nullable: false),
                    DuplicateRiskScore = table.Column<int>(type: "integer", nullable: false),
                    FlagsJson = table.Column<string>(type: "text", nullable: false),
                    HighlightsJson = table.Column<string>(type: "text", nullable: false),
                    MissingDataJson = table.Column<string>(type: "text", nullable: false),
                    AwardImpactJson = table.Column<string>(type: "text", nullable: false),
                    QslJson = table.Column<string>(type: "text", nullable: false),
                    PropagationJson = table.Column<string>(type: "text", nullable: false),
                    SunJson = table.Column<string>(type: "text", nullable: false),
                    WeatherJson = table.Column<string>(type: "text", nullable: false),
                    DuplicateRiskJson = table.Column<string>(type: "text", nullable: false),
                    StoryText = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QsoAnalyses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QsoAnalyses_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QsoAnalyses_QsoEntries_QsoId",
                        column: x => x.QsoId,
                        principalTable: "QsoEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QsoAnalyses_QsoId",
                table: "QsoAnalyses",
                column: "QsoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QsoAnalyses_UserId_DataQualityScore",
                table: "QsoAnalyses",
                columns: new[] { "UserId", "DataQualityScore" });

            migrationBuilder.CreateIndex(
                name: "IX_QsoAnalyses_UserId_GeneratedAtUtc",
                table: "QsoAnalyses",
                columns: new[] { "UserId", "GeneratedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_QsoAnalyses_UserId_OverallScore",
                table: "QsoAnalyses",
                columns: new[] { "UserId", "OverallScore" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QsoAnalyses");
        }
    }
}
