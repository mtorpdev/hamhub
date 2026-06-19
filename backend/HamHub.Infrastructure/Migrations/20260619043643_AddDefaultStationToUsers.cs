using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDefaultStationToUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DefaultStationId",
                table: "AspNetUsers",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_DefaultStationId",
                table: "AspNetUsers",
                column: "DefaultStationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_DefaultStationId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "DefaultStationId",
                table: "AspNetUsers");
        }
    }
}
