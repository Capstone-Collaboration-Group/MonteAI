using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class DirectThesisGroupId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "GroupId",
                table: "Theses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Theses_GroupId",
                table: "Theses",
                column: "GroupId");

            migrationBuilder.AddForeignKey(
                name: "FK_Theses_ResearchGroups_GroupId",
                table: "Theses",
                column: "GroupId",
                principalTable: "ResearchGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Theses_ResearchGroups_GroupId",
                table: "Theses");

            migrationBuilder.DropIndex(
                name: "IX_Theses_GroupId",
                table: "Theses");

            migrationBuilder.DropColumn(
                name: "GroupId",
                table: "Theses");
        }
    }
}
