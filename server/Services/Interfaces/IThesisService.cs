using server.Models.DTOs.Thesis;
using server.Models.Entities;

namespace server.Services.Interfaces
{
    public interface IThesisService
    {
        Task<IEnumerable<ThesisResponseDto>> GetFirst20ThesisAsync();

        Task<ThesisResponseDto?> GetByIdAsync(Guid id);

        Task<ThesisResponseDto> SubmitAsync(SubmitThesisDto submitDto);

        Task<IngestThesisResponseDto> IngestAsync(IngestThesisDto dto);
        Task<string?> GetDownloadUrlAsync(Guid thesisId);
        Task<bool> UpdateDetailsAsync(Guid id, UpdateThesisDto updateThesisdto);

        Task<bool> UpdateStatusAsync(Guid id, UpdateThesisStatusDto updateStatusDto);

        Task<bool> DeleteAsync(Guid id);

        // ThesisVersion services

        Task<IEnumerable<ThesisVersionResponseDto>> GetByVersionsAsync(Guid thesisId);

        Task<ThesisVersionResponseDto?> GetByVersionIdAsync(Guid versionId);

        Task<ThesisVersionResponseDto?> GetLatestThesisIdAsync(Guid thesisId);

        Task<int> GetNextVersionNumber(Guid thesisId);

        Task<bool> CreateThesisVersion(CreateThesisVersionDto thesisVersionDto, string uploadedById);

        Task<bool> DeleteThesisVersion(Guid thesisId);


    }
}
