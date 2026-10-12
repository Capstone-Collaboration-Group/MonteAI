using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class AddUserTotp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RecoveryCodeHashes",
                table: "Students",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TotpEnabled",
                table: "Students",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "TotpLastUsedStep",
                table: "Students",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "TotpSecretEncrypted",
                table: "Students",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecoveryCodeHashes",
                table: "ProgramHeads",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TotpEnabled",
                table: "ProgramHeads",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "TotpLastUsedStep",
                table: "ProgramHeads",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "TotpSecretEncrypted",
                table: "ProgramHeads",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecoveryCodeHashes",
                table: "Faculty",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TotpEnabled",
                table: "Faculty",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "TotpLastUsedStep",
                table: "Faculty",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "TotpSecretEncrypted",
                table: "Faculty",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecoveryCodeHashes",
                table: "Admins",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TotpEnabled",
                table: "Admins",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "TotpLastUsedStep",
                table: "Admins",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "TotpSecretEncrypted",
                table: "Admins",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RecoveryCodeHashes",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "TotpEnabled",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "TotpLastUsedStep",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "TotpSecretEncrypted",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "RecoveryCodeHashes",
                table: "ProgramHeads");

            migrationBuilder.DropColumn(
                name: "TotpEnabled",
                table: "ProgramHeads");

            migrationBuilder.DropColumn(
                name: "TotpLastUsedStep",
                table: "ProgramHeads");

            migrationBuilder.DropColumn(
                name: "TotpSecretEncrypted",
                table: "ProgramHeads");

            migrationBuilder.DropColumn(
                name: "RecoveryCodeHashes",
                table: "Faculty");

            migrationBuilder.DropColumn(
                name: "TotpEnabled",
                table: "Faculty");

            migrationBuilder.DropColumn(
                name: "TotpLastUsedStep",
                table: "Faculty");

            migrationBuilder.DropColumn(
                name: "TotpSecretEncrypted",
                table: "Faculty");

            migrationBuilder.DropColumn(
                name: "RecoveryCodeHashes",
                table: "Admins");

            migrationBuilder.DropColumn(
                name: "TotpEnabled",
                table: "Admins");

            migrationBuilder.DropColumn(
                name: "TotpLastUsedStep",
                table: "Admins");

            migrationBuilder.DropColumn(
                name: "TotpSecretEncrypted",
                table: "Admins");
        }
    }
}
