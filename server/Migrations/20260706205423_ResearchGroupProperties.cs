using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class ResearchGroupProperties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdviserId",
                table: "ResearchGroups",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GroupName",
                table: "ResearchGroups",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LeaderId",
                table: "ResearchGroups",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ResearchTitle",
                table: "ResearchGroups",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_ResearchGroups_AdviserId",
                table: "ResearchGroups",
                column: "AdviserId");

            migrationBuilder.CreateIndex(
                name: "IX_ResearchGroups_LeaderId",
                table: "ResearchGroups",
                column: "LeaderId");

            migrationBuilder.AddForeignKey(
                name: "FK_ResearchGroups_Faculty_AdviserId",
                table: "ResearchGroups",
                column: "AdviserId",
                principalTable: "Faculty",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ResearchGroups_Students_LeaderId",
                table: "ResearchGroups",
                column: "LeaderId",
                principalTable: "Students",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ResearchGroups_Faculty_AdviserId",
                table: "ResearchGroups");

            migrationBuilder.DropForeignKey(
                name: "FK_ResearchGroups_Students_LeaderId",
                table: "ResearchGroups");

            migrationBuilder.DropIndex(
                name: "IX_ResearchGroups_AdviserId",
                table: "ResearchGroups");

            migrationBuilder.DropIndex(
                name: "IX_ResearchGroups_LeaderId",
                table: "ResearchGroups");

            migrationBuilder.DropColumn(
                name: "AdviserId",
                table: "ResearchGroups");

            migrationBuilder.DropColumn(
                name: "GroupName",
                table: "ResearchGroups");

            migrationBuilder.DropColumn(
                name: "LeaderId",
                table: "ResearchGroups");

            migrationBuilder.DropColumn(
                name: "ResearchTitle",
                table: "ResearchGroups");
        }
    }
}
