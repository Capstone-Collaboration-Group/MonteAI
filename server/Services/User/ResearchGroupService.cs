using AutoMapper;
using Microsoft.Identity.Client;
using server.Models.DTOs.ResearchGroup;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.User
{
    public class ResearchGroupService
    (
        IResearchGroupRepository _repo,
        IMapper _mapper
    ) : IResearchGroupService
    {
        public async Task<IEnumerable<ResearchGroupResponseDto>> GetAllAsync()
        {
            var result = await _repo.GetAllResearchGroupsAsync();

            var responseDto = _mapper.Map<IEnumerable<ResearchGroupResponseDto>>(result);
            return responseDto;
        }
        public async Task<ResearchGroupResponseDto?> GetByIdAsync(Guid groupId)
        {
            var result = await _repo.GetResearchGroupByIdAsync(groupId);
            var responseDto =  _mapper.Map<ResearchGroupResponseDto>(result);
            return responseDto;
        }
        public async Task<bool> CreateAsync(CreateResearchGroupDto createDto)
        {
            var researchGroup = _mapper.Map<ResearchGroup>(createDto);
            var result = await _repo.CreateResearchGroupAsync(researchGroup);
            return result;
        }
        public async Task<bool> UpdateAsync(UpdateResearchGroupDto updateDto)
        {
            var researchGroup = _mapper.Map<ResearchGroup>(updateDto);
            var result = await _repo.UpdateResearchGroupAsync(researchGroup);
            return result;
        }
        public async Task<bool> DeleteAsync(Guid groupId)
            => await _repo.DeleteResearchGroupAsync(groupId);

        public Task<bool> UpdateAsync(Guid id, UpdateResearchGroupDto updateDto)
        {
            throw new NotImplementedException();
        }
    }
}
