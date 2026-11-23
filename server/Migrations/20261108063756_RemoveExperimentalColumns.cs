using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class RemoveExperimentalColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn( 
                name: "RegistrationVerificationEngine",
                table: "Students"
            );
            migrationBuilder.DropColumn( 
                name: "RegistrationVerificationMethod",
                table: "Students"
            );
            migrationBuilder.DropColumn(
                name: "RegistrationVerifiedAt",
                table: "Students"
            );
            //Admins
            migrationBuilder.DropColumn( 
                name: "RegistrationVerificationEngine",
                table: "Admins"
            );
            migrationBuilder.DropColumn( 
                name: "RegistrationVerificationMethod",
                table: "Admins"
            );
            migrationBuilder.DropColumn(
                name: "RegistrationVerifiedAt",
                table: "Admins"
            );

            // Program Heads
            migrationBuilder.DropColumn( 
                name: "RegistrationVerificationEngine",
                table: "ProgramHeads"
            );
            migrationBuilder.DropColumn( 
                name: "RegistrationVerificationMethod",
                table: "ProgramHeads"
            );
            migrationBuilder.DropColumn(
                name: "RegistrationVerifiedAt",
                table: "ProgramHeads"
            );
            
            // Faculty
            migrationBuilder.DropColumn( 
                name: "RegistrationVerificationEngine",
                table: "Faculty"
            );
            migrationBuilder.DropColumn( 
                name: "RegistrationVerificationMethod",
                table: "Faculty"
            );
            migrationBuilder.DropColumn(
                name: "RegistrationVerifiedAt",
                table: "Faculty"
            );


        }
        //RegistrationVerificationEngine	RegistrationVerificationMethod	RegistrationVerifiedAt

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
