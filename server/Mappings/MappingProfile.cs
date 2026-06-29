// Auto mapper for conversion of DTOs to Entities
using AutoMapper;
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
        }

    }
}