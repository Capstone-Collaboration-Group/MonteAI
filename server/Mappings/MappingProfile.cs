// Auto mapper for conversion of DTOs to Entities
using AutoMapper;
using server.Models.DTOs.Announcement;
using server.Models.DTOs.ChatMessage;
using server.Models.DTOs.ChatSession;
using server.Models.DTOs.PanelistSchedule;
using server.Models.DTOs.ProgramHead;
using server.Models.DTOs.ResearchGroup;
using server.Models.DTOs.Review;
using server.Models.DTOs.Schedule;
using server.Models.DTOs.Submission;
using server.Models.DTOs.Thesis;
using server.Models.DTOs.User;
using server.Models.Entities;
using server.Models.Retrieval;

namespace server.Mappings
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            //Thesis Mappings
            CreateMap<Thesis, ThesisResponseDto>();
            CreateMap<SubmitThesisDto, Thesis>();
            CreateMap<UpdateThesisDto, Thesis>();
            CreateMap<UpdateThesisStatusDto, Thesis>();
            CreateMap<ThesisChunkDto, Chunk>()
                .ForCtorParam(nameof(Chunk.RelevanceScore), opt => opt.MapFrom(_ => (string?)null));

            //User Mappings
            CreateMap<Student, UserResponseDto>();
            CreateMap<Faculty, UserResponseDto>();
            CreateMap<Admin, UserResponseDto>();
            CreateMap<ProgramHead, UserResponseDto>();

            foreach(var type in new[] {typeof(Student), typeof(Faculty), typeof(ProgramHead), typeof(Admin) })
                CreateMap(type, typeof(UserResponseDto));

            CreateMap<RegisterUserDto, Faculty>();
            CreateMap<RegisterUserDto, Admin>();
            CreateMap<RegisterUserDto, ProgramHead>();
            CreateMap<RegisterUserDto, Student>()
                .ForMember(dest => dest.Section, opt => opt.MapFrom(src =>
                    string.IsNullOrEmpty(src.Section) ? default : src.Section[0]));

            // ── UpdateUserDto → Entities (for partial updates) ────
            CreateMap<UpdateUserDto, Student>()
                .ForAllMembers(opt => opt.Condition((src, dest, srcMember) => srcMember != null));
            CreateMap<UpdateUserDto, Faculty>()
                .ForAllMembers(opt => opt.Condition((src, dest, srcMember) => srcMember != null));
            CreateMap<UpdateUserDto, Admin>()
                .ForAllMembers(opt => opt.Condition((src, dest, srcMember) => srcMember != null));
            CreateMap<UpdateUserDto, ProgramHead>()
                .ForAllMembers(opt => opt.Condition((src, dest, srcMember) => srcMember != null));

            CreateMap<UpdateProgramHeadDto, ProgramHead>();
            

            // ChatSession
            CreateMap<ChatSession, ChatSessionResponseDto>();
            CreateMap<CreateChatSessionDto, ChatSession>();
            CreateMap<UpdateChatSessionDto, ChatSession>();

            // ChatMessage
            CreateMap<ChatMessage, ChatMessageResponseDto>();
            CreateMap<CreateChatMessageDto, ChatMessage>();

            //  PanelistSchedule  
            CreateMap<PanelistSchedule, PanelistScheduleResponseDto>();
            CreateMap<CreatePanelistScheduleDto, PanelistSchedule>(); // Will be deprecated soon
            CreateMap<CreatePanelistEntryDto, PanelistSchedule>();
            CreateMap<UpdatePanelistScheduleDto, PanelistSchedule>()
                .ForAllMembers(opt => opt.Condition((src, dest, srcMember) => srcMember != null));

            // ResearchGroup
            CreateMap<ResearchGroup, ResearchGroupResponseDto>();
            CreateMap<CreateResearchGroupDto, ResearchGroup>();
            CreateMap<UpdateResearchGroupDto, ResearchGroup>();

            // Review
            CreateMap<Review, ReviewResponseDto>();
            CreateMap<CreateReviewDto, Review>();
            CreateMap<UpdateReviewDto, Review>();

            // Schedule
            CreateMap<Schedule, ScheduleResponseDto>();
            CreateMap<CreateScheduleDto, Schedule>()
                .ForMember(dest => dest.Panelists, opt => opt.Ignore());

            CreateMap<UpdateScheduleDto, Schedule>()
                .ForMember(dest => dest.Panelists, opt => opt.Ignore())
                .ForAllMembers(opt => opt.Condition((src, dest, srcMember) => srcMember != null));

            // Submission 
            CreateMap<Submission, SubmissionResponseDto>()
                .ForMember(dest => dest.StudentName, opt => opt.MapFrom(src =>
                $"{src.Student.FirstName} {src.Student.MiddleInitial}. {src.Student.LastName}".Trim()));
            CreateMap<CreateSubmissionDto, Submission>();
            CreateMap<UpdateSubmissionDto, Submission>();

            // Announcement 
            CreateMap<Announcement, AnnouncementResponseDto>()
                   .ForMember(dest => dest.Author, opt => opt.MapFrom(src => ResolveAnnouncementAuthor(src)));
            CreateMap<CreateAnnouncementDto, Announcement>();
            CreateMap<UpdateAnnouncementDto, Announcement>();
           

        }
        private static AnnouncementAuthorDto ResolveAnnouncementAuthor(Announcement src)
        {
            if (src.CreatedByAdmin != null)
                return new AnnouncementAuthorDto
                {
                    Id = src.CreatedByAdmin.Id,
                    FullName = $"{src.CreatedByAdmin.FirstName} {src.CreatedByAdmin.LastName}",
                    Role = "Admin"
                };
            if (src.CreatedByProgramHead != null)
                return new AnnouncementAuthorDto
                {
                    Id = src.CreatedByProgramHead.Id,
                    FullName = $"{src.CreatedByProgramHead.FirstName} {src.CreatedByProgramHead.LastName}",
                    Role = "ProgramHead"
                };
            return new AnnouncementAuthorDto { Id = string.Empty, FullName = "Unknown", Role = "Unknown" };
        }

    }
}