using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class EnforceStudentIdVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "MiddleInitial",
                table: "Students",
                type: "nvarchar(1)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(1)");

            migrationBuilder.AlterColumn<string>(
                name: "MiddleInitial",
                table: "ProgramHeads",
                type: "nvarchar(1)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(1)");

            migrationBuilder.AlterColumn<string>(
                name: "MiddleInitial",
                table: "Faculty",
                type: "nvarchar(1)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(1)");

            migrationBuilder.AlterColumn<string>(
                name: "MiddleInitial",
                table: "Admins",
                type: "nvarchar(1)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(1)");

            migrationBuilder.CreateTable(
                name: "ConsumedIdVerificationReceipts",
                columns: table => new
                {
                    Jti = table.Column<string>(type: "nvarchar(36)", maxLength: 36, nullable: false),
                    FirebaseUid = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    RegistrationFingerprint = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    TemplateId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ConsumedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsumedIdVerificationReceipts", x => x.Jti);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConsumedIdVerificationReceipts_FirebaseUid",
                table: "ConsumedIdVerificationReceipts",
                column: "FirebaseUid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConsumedIdVerificationReceipts");

            migrationBuilder.AlterColumn<string>(
                name: "MiddleInitial",
                table: "Students",
                type: "nvarchar(1)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(1)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "MiddleInitial",
                table: "ProgramHeads",
                type: "nvarchar(1)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(1)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "MiddleInitial",
                table: "Faculty",
                type: "nvarchar(1)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(1)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "MiddleInitial",
                table: "Admins",
                type: "nvarchar(1)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(1)",
                oldNullable: true);
        }
    }
}
