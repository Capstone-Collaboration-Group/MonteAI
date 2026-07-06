
using AutoMapper;
using server.Models.DTOs.Submission;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.Theses
{
    public class SubmissionService : ISubmissionService
    {
        private readonly ISubmissionRepository _repo;
        private readonly ILogger<SubmissionService> _logger;
        private readonly IMapper _mapper;

        public SubmissionService(ISubmissionRepository repo, ILogger<SubmissionService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
        }

        public async Task<IEnumerable<SubmissionResponseDto>> GetAllAsync()
        {
            var result = await _repo.GetAllSubmissionsAsync();
            var dto = _mapper.Map<IEnumerable<SubmissionResponseDto>>(result);

            _logger.LogInformation("Fetched All {count} Submissions", dto.Count());
            return dto;
        }
        public async Task<IEnumerable<SubmissionResponseDto>> GetAllByUserIdAsync(string studentNumber, Guid thesisId)
        {
            var result = await _repo.GetSubmissionsByUserIdAsync(studentNumber, thesisId);
            var dto = _mapper.Map<IEnumerable<SubmissionResponseDto>>(result);
            _logger.LogInformation("Fetched {count} user specific submissions", dto.Count());

            return dto;
        }
        public async Task<SubmissionResponseDto?> GetByIdAsync(Guid submissionId)
        {
            var result = await _repo.GetSubmissionByIdAsync(submissionId);
            var dto = _mapper.Map<SubmissionResponseDto>(result);
            _logger.LogInformation("Fetched submissino with Id: {submissionId}", submissionId);
            return dto;
        }

        public async Task<SubmissionResponseDto?> CreateAsync(CreateSubmissionDto dto)
        {
            var createDto = _mapper.Map<Submission>(dto);
            
            var result = await _repo.CreateSubmissionAsync(createDto);

            if (result == null) return null;

            _logger.LogInformation("Submission Created Successfully");

            var responseDto = _mapper.Map<SubmissionResponseDto>(result);
            return responseDto;

        }

        public async Task<SubmissionResponseDto?> UpdateAsync(UpdateSubmissionDto dto, Guid submissionId)
        {
            var updateSubmission = _mapper.Map<Submission>(dto);
            updateSubmission.Id = submissionId;
            var result = await _repo.UpdateSubmissionAsync(updateSubmission);
            if (result == null) return null;
            _logger.LogInformation("Submission Id: {Id} Updated", result.Id);

            var responseDto = _mapper.Map<SubmissionResponseDto>(result);

            return responseDto;

        }
        public async Task<bool> DeleteAsync(Guid submissionId)
        {
            var result = await _repo.DeleteSubmissionAsync(submissionId);
            return result;
        }


    }
}