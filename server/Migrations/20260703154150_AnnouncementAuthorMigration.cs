using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class AnnouncementAuthorMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateTime>(
                name: "LastChatDate",
                table: "ChatSessions",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "GETUTCDATE()",
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: true,
                oldDefaultValueSql: "GETUTCDATE()");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "ChatSessions",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "GETUTCDATE()",
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: true,
                oldDefaultValueSql: "GETUTCDATE()");

            migrationBuilder.AddColumn<string>(
                name: "CreatedByAdminId",
                table: "Announcements",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByProgramHeadId",
                table: "Announcements",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_CreatedByAdminId",
                table: "Announcements",
                column: "CreatedByAdminId");

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_CreatedByProgramHeadId",
                table: "Announcements",
                column: "CreatedByProgramHeadId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Announcement_SingleAuthor",
                table: "Announcements",
                sql: "([CreatedByAdminId] IS NOT NULL AND [CreatedByProgramHeadId] IS NULL) OR ([CreatedByAdminId] IS NULL AND [CreatedByProgramHeadId] IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_Announcements_Admins_CreatedByAdminId",
                table: "Announcements",
                column: "CreatedByAdminId",
                principalTable: "Admins",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Announcements_ProgramHeads_CreatedByProgramHeadId",
                table: "Announcements",
                column: "CreatedByProgramHeadId",
                principalTable: "ProgramHeads",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Announcements_Admins_CreatedByAdminId",
                table: "Announcements");

            migrationBuilder.DropForeignKey(
                name: "FK_Announcements_ProgramHeads_CreatedByProgramHeadId",
                table: "Announcements");

            migrationBuilder.DropIndex(
                name: "IX_Announcements_CreatedByAdminId",
                table: "Announcements");

            migrationBuilder.DropIndex(
                name: "IX_Announcements_CreatedByProgramHeadId",
                table: "Announcements");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Announcement_SingleAuthor",
                table: "Announcements");

            migrationBuilder.DropColumn(
                name: "CreatedByAdminId",
                table: "Announcements");

            migrationBuilder.DropColumn(
                name: "CreatedByProgramHeadId",
                table: "Announcements");

            migrationBuilder.AlterColumn<DateTime>(
                name: "LastChatDate",
                table: "ChatSessions",
                type: "datetime2",
                nullable: true,
                defaultValueSql: "GETUTCDATE()",
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "GETUTCDATE()");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "ChatSessions",
                type: "datetime2",
                nullable: true,
                defaultValueSql: "GETUTCDATE()",
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "GETUTCDATE()");
        }
    }
}
