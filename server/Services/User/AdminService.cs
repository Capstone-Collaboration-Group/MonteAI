using AutoMapper;
using Microsoft.AspNetCore.Http.HttpResults;
using server.Models.DTOs.Admin;
using server.Models.DTOs.User;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.User
{
    public class AdminService : IAdminService
    {
        private readonly IAdminRepository _repo;
        private readonly ILogger<AdminService> _logger;
        private readonly IMapper _mapper;

        public AdminService(IAdminRepository repo, ILogger<AdminService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
        }

        public async Task<IEnumerable<UserResponseDto>> GetAllAsync()
        {
            var result = await _repo.GetAllAdminsAsync();
            
            var dto = _mapper.Map<IEnumerable<UserResponseDto>>(result);

            return dto;
        }

        public async Task<UserResponseDto> GetByIdAsync(string id)
        {
            var result = await _repo.GetAdminByIdAsync(id);
            var dto = _mapper.Map<UserResponseDto>(result);

           
            return dto;
        }
        public async Task<bool> CreateAsync(RegisterUserDto createDto)
        {
            var admin = _mapper.Map<Admin>(createDto);
            var result = await _repo.CreateAdminAsync(admin);
            return result;
        }

        public async Task<bool> UpdateAsync(UpdateUserDto updateDto)
        {
            var admin = _mapper.Map<Admin>(updateDto);
            var result = await _repo.UpdateAdminAsync(admin);
            return result;
        }

        public async Task<bool> DeleteAsync(string id)
        {
            var result = await _repo.DeleteAdminAsync(id);
            return result;
        }
    }
}