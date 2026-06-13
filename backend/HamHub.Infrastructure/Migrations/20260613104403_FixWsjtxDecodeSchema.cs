using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixWsjtxDecodeSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "DeltaFreqHz",
                table: "WsjtxDecodes",
                type: "integer",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.CreateIndex(
                name: "IX_WsjtxDecodes_UserId",
                table: "WsjtxDecodes",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_WsjtxDecodes_AspNetUsers_UserId",
                table: "WsjtxDecodes",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WsjtxDecodes_AspNetUsers_UserId",
                table: "WsjtxDecodes");

            migrationBuilder.DropIndex(
                name: "IX_WsjtxDecodes_UserId",
                table: "WsjtxDecodes");

            migrationBuilder.AlterColumn<long>(
                name: "DeltaFreqHz",
                table: "WsjtxDecodes",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
        }
    }
}
