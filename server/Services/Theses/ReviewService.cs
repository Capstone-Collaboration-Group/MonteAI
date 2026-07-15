using AutoMapper;
using Mapster;
using server.Models.DTOs.Review;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.Theses
{
    public class ReviewService : IReviewService
    {
        private readonly IReviewRepository _repo;
        private readonly ILogger<ReviewService> _logger;
        private readonly IMapper _mapper;

        public ReviewService(IReviewRepository repo, ILogger<ReviewService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
        }

        public async Task<IEnumerable<ReviewResponseDto>> GetAllAsync()
        {
            var result = await _repo.GetAllReviewsAsync();
            var responseDto = _mapper.Map<IEnumerable<ReviewResponseDto>>(result);
            return responseDto;
        }
        public async Task<ReviewResponseDto?> GetByIdAsync(Guid id)
        {
            var result = await _repo.GetReviewByIdAsync(id);
            if (result == null) return null;
            var responseDto = _mapper.Map<ReviewResponseDto>(result);
            
            return responseDto;
        }

        public async Task<bool> CreateAsync(CreateReviewDto createDto)
        {
            var review = _mapper.Map<Review>(createDto);
            var result = await _repo.CreateReviewAsync(review);

            return result;
        }
        public async Task<bool> UpdateAsync(UpdateReviewDto updateDto, Guid id)
        {
            var updateReview = _mapper.Map<Review>(updateDto);
            updateReview.Id = id;
            var result = await _repo.UpdateReviewAsync(updateReview);

            return result;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var result = await _repo.DeleteReviewAsync(id);
            return result;
        }

    }
}