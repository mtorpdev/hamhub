using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HamHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCommunityRooms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CommunityRoomId",
                table: "Posts",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CommunityRooms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Slug = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsSystem = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommunityRooms", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Posts_CommunityRoomId",
                table: "Posts",
                column: "CommunityRoomId");

            migrationBuilder.CreateIndex(
                name: "IX_CommunityRooms_Slug",
                table: "CommunityRooms",
                column: "Slug",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Posts_CommunityRooms_CommunityRoomId",
                table: "Posts",
                column: "CommunityRoomId",
                principalTable: "CommunityRooms",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Posts_CommunityRooms_CommunityRoomId",
                table: "Posts");

            migrationBuilder.DropTable(
                name: "CommunityRooms");

            migrationBuilder.DropIndex(
                name: "IX_Posts_CommunityRoomId",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "CommunityRoomId",
                table: "Posts");
        }
    }
}
