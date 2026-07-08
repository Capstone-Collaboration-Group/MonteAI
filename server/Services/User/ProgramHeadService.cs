using AutoMapper;
using Mapster;
using server.Models.DTOs.ProgramHead;
using server.Models.DTOs.User;
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
        public async Task<IEnumerable<UserResponseDto>> GetAllAsync()
        {
        var result = await _repo.GetAllProgramHeadsAsync();

        var responseDto = _mapper.Map<IEnumerable<UserResponseDto>>(result);

        return responseDto;
        }
        public async Task<UserResponseDto?> GetByIdAsync(string id)
        {
            var result = await _repo.GetProgramHeadByIdAsync(id);
            var responseDto = _mapper.Map<UserResponseDto>(result);
            return responseDto;
        }
        public async Task<bool> CreateAsync(RegisterUserDto createDto)
        {
            Console.WriteLine($"Id is {createDto.Id}");
            var programHead = _mapper.Map<ProgramHead>(createDto);
            var result = await _repo.CreateProgramHeadAsync(programHead);

            return result;
        }
        public async Task<bool> UpdateAsync(UpdateProgramHeadDto updateDto, string id)
        {
            var programHead = _mapper.Map<ProgramHead>(updateDto);

            var result = await _repo.UpdateProgramHeadAsync(programHead, id);

            return result;
        }
        public async Task<bool> DeleteAsync(string id)
        {
            return await _repo.DeleteProgramHeadAsync(id);
        }
    }
}