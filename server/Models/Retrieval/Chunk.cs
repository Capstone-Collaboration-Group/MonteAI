namespace server.Models.Retrieval
{
    public record Chunk
    (
        string Text,
        string? Title,
        string? Url,
        string? Authors,
        string? PublicationYear,
        string? Journal,
        string? RelevanceScore
    );
    
    
}
