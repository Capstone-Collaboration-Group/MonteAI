// Auto mapper for conversion of DTOs to Entities
using AutoMapper;
using server.Models.DTOs.Announcement;
using server.Models.DTOs.ChatMessage;
using server.Models.DTOs.ChatSession;
using server.Models.DTOs.PanelistSchedule;
using server.Models.DTOs.ResearchGroup;
using server.Models.DTOs.Review;
using server.Models.DTOs.Schedule;
using server.Models.DTOs.Thesis;
using server.Models.DTOs.User;
using server.Models.Entities;

namespace server.Mappings
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            //Thesis Mappings
            CreateMap<Thesis, ThesisResponseDto>();
            CreateMap<Thesis, CreateThesisDto>();
            CreateMap<Thesis, UpdateThesisDto>();
            CreateMap<Thesis, UpdateThesisStatusDto>();

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

            // ChatSession
            CreateMap<ChatSession, ChatSessionResponseDto>();
            CreateMap<CreateChatSessionDto, ChatSession>();
            CreateMap<UpdateChatSessionDto, ChatSession>();

            // ChatMessage
            CreateMap<ChatMessage, ChatMessageResponseDto>();
            CreateMap<CreateChatMessageDto, ChatMessage>();

            //  PanelistSchedule 
            CreateMap<PanelistSchedule, PanelistScheduleResponseDto>();
            CreateMap<PanelistSchedule, CreatePanelistScheduleDto>();
            CreateMap<PanelistSchedule, UpdatePanelistScheduleDto>();

            // ResearchGroup
            CreateMap<ResearchGroup, ResearchGroupResponseDto>();
            CreateMap<ResearchGroup, CreateResearchGroupDto>();
            CreateMap<ResearchGroup, UpdateResearchGroupDto>();

            // Review
            CreateMap<Review, ReviewResponseDto>();
            CreateMap<Review, CreateReviewDto>();
            CreateMap<Review, UpdateReviewDto>();

            // Schedule
            CreateMap<Schedule, ScheduleResponseDto>();
            CreateMap<Schedule, CreateScheduleDto>();
            CreateMap<Schedule, UpdateScheduleDto>();

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