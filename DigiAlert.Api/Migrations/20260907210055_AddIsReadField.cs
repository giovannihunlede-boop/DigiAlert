using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigiAlert.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsReadField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_read",
                table: "reminders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_read",
                table: "events",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_read",
                table: "reminders");

            migrationBuilder.DropColumn(
                name: "is_read",
                table: "events");
        }
    }
}
