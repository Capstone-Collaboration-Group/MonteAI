using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    public partial class AddEmailVerificationFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in new[] { "Admins", "Faculty", "ProgramHeads", "Students" })
            {
                migrationBuilder.AddColumn<bool>(table, "IsEmailVerified", nullable: false, defaultValue: false);
                migrationBuilder.AddColumn<string>(table, "OtpCode", maxLength: 6, nullable: true);
                migrationBuilder.AddColumn<DateTime>(table, "OtpExpiresAt", nullable: true);
                migrationBuilder.AddColumn<DateTime>(table, "OtpWindowStartedAt", nullable: true);
                migrationBuilder.AddColumn<int>(table, "OtpResendCount", nullable: false, defaultValue: 0);
            }
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in new[] { "Admins", "Faculty", "ProgramHeads", "Students" })
            {
                migrationBuilder.DropColumn(table, "IsEmailVerified");
                migrationBuilder.DropColumn(table, "OtpCode");
                migrationBuilder.DropColumn(table, "OtpExpiresAt");
                migrationBuilder.DropColumn(table, "OtpWindowStartedAt");
                migrationBuilder.DropColumn(table, "OtpResendCount");
            }
        }
    }
}