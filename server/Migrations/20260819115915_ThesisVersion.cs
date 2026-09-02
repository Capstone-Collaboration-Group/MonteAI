using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class ThesisVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ThesisVersionId",
                table: "Reviews",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ThesisVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    ThesisId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VersionNumber = table.Column<int>(type: "int", nullable: false),
                    FilePath = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThesisVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThesisVersions_Theses_ThesisId",
                        column: x => x.ThesisId,
                        principalTable: "Theses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_ThesisVersionId",
                table: "Reviews",
                column: "ThesisVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_ThesisVersions_ThesisId",
                table: "ThesisVersions",
                column: "ThesisId");

            migrationBuilder.AddForeignKey(
                name: "FK_Reviews_ThesisVersions_ThesisVersionId",
                table: "Reviews",
                column: "ThesisVersionId",
                principalTable: "ThesisVersions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Reviews_ThesisVersions_ThesisVersionId",
                table: "Reviews");

            migrationBuilder.DropTable(
                name: "ThesisVersions");

            migrationBuilder.DropIndex(
                name: "IX_Reviews_ThesisVersionId",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "ThesisVersionId",
                table: "Reviews");
        }
    }
}
