using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class AddResearchGroupInvitation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ResearchGroupInvitations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LeaderId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    StudentId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResearchGroupInvitations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResearchGroupInvitations_ResearchGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "ResearchGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ResearchGroupInvitations_Students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ResearchGroupInvitations_GroupId_StudentId",
                table: "ResearchGroupInvitations",
                columns: new[] { "GroupId", "StudentId" });

            migrationBuilder.CreateIndex(
                name: "IX_ResearchGroupInvitations_StudentId",
                table: "ResearchGroupInvitations",
                column: "StudentId");

            // One-time repair: prior to this build, deleting a group left its
            // leader with Position = "Leader" even though GroupId was nulled
            // by the FK cascade. That stale value made them uninvitable and
            // blocked the thesis leadership checks. Anyone with no group now
            // is a plain member.
            migrationBuilder.Sql(
                "UPDATE [Students] SET [Position] = 'Member' " +
                "WHERE [Position] = 'Leader' AND [GroupId] IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ResearchGroupInvitations");
        }
    }
}
