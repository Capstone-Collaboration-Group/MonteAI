using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActivityLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Query = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    NormalizedQuery = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ThesisId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UserId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityLogs_NormalizedQuery",
                table: "ActivityLogs",
                column: "NormalizedQuery");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityLogs_ThesisId",
                table: "ActivityLogs",
                column: "ThesisId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityLogs_Type_OccurredAt",
                table: "ActivityLogs",
                columns: new[] { "Type", "OccurredAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActivityLogs");
        }
    }
}
