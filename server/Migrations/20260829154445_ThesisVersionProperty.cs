using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class ThesisVersionProperty : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Reviews_ThesisVersions_ThesisVersionId",
                table: "Reviews");

            migrationBuilder.DropIndex(
                name: "IX_Reviews_ThesisVersionId",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "ThesisVersionId",
                table: "Reviews");

            migrationBuilder.AddColumn<string>(
                name: "ChangeNote",
                table: "ThesisVersions",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UploadedById",
                table: "ThesisVersions",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChangeNote",
                table: "ThesisVersions");

            migrationBuilder.DropColumn(
                name: "UploadedById",
                table: "ThesisVersions");

            migrationBuilder.AddColumn<Guid>(
                name: "ThesisVersionId",
                table: "Reviews",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_ThesisVersionId",
                table: "Reviews",
                column: "ThesisVersionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Reviews_ThesisVersions_ThesisVersionId",
                table: "Reviews",
                column: "ThesisVersionId",
                principalTable: "ThesisVersions",
                principalColumn: "Id");
        }
    }
}
