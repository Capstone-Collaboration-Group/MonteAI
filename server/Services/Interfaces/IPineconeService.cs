using server.Models.Retrieval;

namespace server.Services.Interfaces
{
    public interface IPineconeService 
    {
        Task<List<Chunk>> RetrieveRelevantChunksAsync(string query);
        Task<bool> UpsertAbstractAsync(string id, Chunk chunk);

    }
}
