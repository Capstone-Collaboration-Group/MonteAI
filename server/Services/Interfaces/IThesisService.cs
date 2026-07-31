using server.Models.DTOs.Thesis;

namespace server.Services.Interfaces
{
    public interface IThesisService
    {
        Task<IEnumerable<ThesisResponseDto>> GetFirst20ThesisAsync();

        Task<ThesisResponseDto?> GetByIdAsync(Guid id);

        Task<ThesisResponseDto> SubmitAsync(SubmitThesisDto submitDto);

        Task<IngestThesisResponseDto> IngestAsync(IngestThesisDto dto);
        Task<bool> UpdateDetailsAsync(Guid id, UpdateThesisDto updateThesisdto);

        Task<bool> UpdateStatusAsync(Guid id, UpdateThesisStatusDto updateStatusDto);

        Task<bool> DeleteAsync(Guid id);

    }
}
