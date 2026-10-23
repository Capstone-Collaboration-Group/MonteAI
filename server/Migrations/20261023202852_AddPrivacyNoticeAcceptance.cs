using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivacyNoticeAcceptance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PrivacyNoticeAcceptedAt",
                table: "Students",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrivacyNoticeVersion",
                table: "Students",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PrivacyNoticeAcceptedAt",
                table: "ProgramHeads",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrivacyNoticeVersion",
                table: "ProgramHeads",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PrivacyNoticeAcceptedAt",
                table: "Faculty",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrivacyNoticeVersion",
                table: "Faculty",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PrivacyNoticeAcceptedAt",
                table: "Admins",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrivacyNoticeVersion",
                table: "Admins",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PrivacyNoticeAcceptedAt",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "PrivacyNoticeVersion",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "PrivacyNoticeAcceptedAt",
                table: "ProgramHeads");

            migrationBuilder.DropColumn(
                name: "PrivacyNoticeVersion",
                table: "ProgramHeads");

            migrationBuilder.DropColumn(
                name: "PrivacyNoticeAcceptedAt",
                table: "Faculty");

            migrationBuilder.DropColumn(
                name: "PrivacyNoticeVersion",
                table: "Faculty");

            migrationBuilder.DropColumn(
                name: "PrivacyNoticeAcceptedAt",
                table: "Admins");

            migrationBuilder.DropColumn(
                name: "PrivacyNoticeVersion",
                table: "Admins");
        }
    }
}
