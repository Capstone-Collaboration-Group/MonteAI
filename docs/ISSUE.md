### Issue #103 Create Data-Transfer Object (server)

Write the Data-Transfer Object for the Entities found inside the server/Models/Entities Folder.
Create the following DTOs of the following: 
- [ ] ChatMessage.cs
- [ ] Admin.cs
- [ ] Announcement.cs
- [ ] ChatSession.cs
- [ ] Faculty.cs
- [ ] PanelistSchedule.cs
- [ ] ProgramHead.cs
- [ ] ResearchGroup.cs
- [ ] Review.cs
- [ ] Schedule.cs
- [ ] Student.cs


**The DTOs must have its own dedicated folder that needs to be put inside the server/Models/DTOs Folder.**

**Ensure that the DTO class is named as the following format *[ClassDto.cs]***
For example, ***Thesis.cs*** class is created as ***ThesisDto.cs*** DTO inside the server/Models/DTOs/Thesis Folder

Inside the *ThesisDto.cs*, Define 3 public classes and its ***Properties*** which is responsible for creation, update, and responses. 

**Example:**

```csharp 
namespace server.Models.DTOs.Thesis //<-- The Directory
{
    // CreateThesisDto
    public class CreateThesisDto { 
        //Properties
        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Abstract { get; set; } = string.Empty;

        [Required]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        public string UploadedById { get; set; } = string.Empty;
    }

    // UpdateThesisDto
    public class UpdateThesisDto
    {
        //Properties
        [MaxLength(255)]
        public string? Title { get; set; }
        public string? Abstract { get; set; }
        public string? FilePath { get; set; }
    }

    //UpdateThesisStatusDto
    public class UpdateThesisStatusDto
    {
        //Properties
        [Required]
        [MaxLength(15)]
        public string Status { get; set; } = string.Empty;
    }


    // ThesisResponseDto
    public class ThesisResponseDto
    {
        //Properties
        public Guid Id { get; set; }
        public string? Title { get; set; }
        public string? Abstract { get; set; }
        public string FilePath { get; set; } = string.Empty;
        public string UploadedById { get; set; } = string.Empty;
        public string? Status { get; set; }
        public string? PineconeStatus { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? RejectedAt { get; set; }
        public DateTime? IndexedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}


```

**REMINDER**
Always follow the **Pascal Case** naming convention of the class and properties
*Ex. MyVariableName*




### Issue 104 API Controller Boilerplate
Write the API controller classses inside the server/Controllers folder. 
Inside, you'll see the following classes: 
- [ ] AdminController.cs
- [ ] AnnouncementController.cs
- [ ] ChatController.cs
- [ ] FacultyController.cs
- [ ] PanelistScheduleController.cs
- [ ] ProgramHeadController.cs
- [ ] ReviewController.cs
- [ ] ScheduleController.cs


What you need to do is to define the **public class** inside the respective classes. 

*For Example: AdminController.cs*
```csharp 
using System;
using Microsoft.AspNetCre.Mvc;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class AdminController : ControllerBase //<-- Inherited from Microsoft.AspNetCore.Mvc
    private readonly ILogger<AdminController> _logger;

    // Constructor
    public AdminController(Ilogger<AdminController> logger) { 
        _logger = logger
    }
}
```

Use the guide sample code above to define other controller classes.




### Issue #105 AutoMapper DTOs Creation (server)
Create the Mapping of the Created DTOs completed from *Issue #102*
Ensure that all DTOs are mapped to its respective Entities 


### Issue #105 "Implement Repository & Service Layer"
Create the repository and service layer with its interfaces for the following Entities
- [ ] ChatSession.cs
- [ ] Faculty.cs
- [ ] PanelistSchedule.cs
- [ ] ProgramHead.cs
- [ ] ResearchGroup.cs
- [ ] Review.cs
- [ ] Schedule.cs
- [ ] Student.cs
- [ ] Announcement.cs
- [ ] Register in DI (verify Scrutor picks it up)
- [ ] Manual test (via Swagger/Postman) for basic CRUD