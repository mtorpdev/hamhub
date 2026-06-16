using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddArticleFeedMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FeedGuid",
                table: "Articles",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ImportedAt",
                table: "Articles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OriginalUrl",
                table: "Articles",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceName",
                table: "Articles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceUrl",
                table: "Articles",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Articles_FeedGuid",
                table: "Articles",
                column: "FeedGuid");

            migrationBuilder.CreateIndex(
                name: "IX_Articles_OriginalUrl",
                table: "Articles",
                column: "OriginalUrl");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Articles_FeedGuid",
                table: "Articles");

            migrationBuilder.DropIndex(
                name: "IX_Articles_OriginalUrl",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "FeedGuid",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "ImportedAt",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "OriginalUrl",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "SourceName",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "SourceUrl",
                table: "Articles");
        }
    }
}
