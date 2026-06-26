using server.Models.DTOs.Thesis;


namespace server.Services.Interfaces
{
    public interface IThesisService
    {
        Task<IEnumerable<ThesisResponseDto>> GetFirst20ThesisAsync();

        //Task<Thesis?> GetThesisByIdAsync(Guid id);

        //Task<bool> UpdateDetailsAsync(Thesis thesis);

        //Task<bool> UpdateStatusAsync(Guid id, string status);

        //Task<bool> DeleteThesisAsync(Guid id);
    }
}
