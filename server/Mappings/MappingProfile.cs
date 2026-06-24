// Auto mapper for conversion of DTOs to Entities
using AutoMapper;
using server.Models.DTOs.Thesis;
using server.Models.Entities;

namespace server.Mappings
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            CreateMap<Thesis, ThesisResponseDto>();
            CreateMap<Thesis, CreateThesisDto>();
            CreateMap<Thesis, UpdateThesisDto>();
            CreateMap<Thesis, UpdateThesisStatusDto>();
        }
    }
}