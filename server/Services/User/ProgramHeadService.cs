using AutoMapper;
using Mapster;
using server.Models.DTOs.ProgramHead;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.User
{
    public class ProgramHeadService
    (
    IProgramHeadRepository _repo,
    IMapper _mapper
    ): IProgramHeadService
    {
        public async Task<IEnumerable<ProgramHeadResponseDto>> GetAllAsync()
        {
        var result = await _repo.GetAllProgramHeadsAsync();

        var responseDto = _mapper.Map<IEnumerable<ProgramHeadResponseDto>>(result);

        return responseDto;
        }
        public async Task<ProgramHeadResponseDto> GetByIdAsync(string id)
        {
            var result = await _repo.GetProgramHeadByIdAsync(id);
            var responseDto = _mapper.Map<ProgramHeadResponseDto>(result);
            return responseDto;
        }
        public async Task<bool> CreateAsync(CreateProgramHeadDto createDto)
        {
            var programHead = _mapper.Map<ProgramHead>(createDto);
            var result = await _repo.CreateProgramHeadAsync(programHead);

            return result;
        }
        public async Task<bool> UpdateAsync(UpdateProgramHeadDto updateDto)
        {
            var programHead = _mapper.Map<ProgramHead>(updateDto);

            var result = await _repo.UpdateProgramHeadAsync(programHead);

            return result;
        }
        public async Task<bool> DeleteAsync(string id)
        {
            return await _repo.DeleteProgramHeadAsync(id);
        }
    }
}