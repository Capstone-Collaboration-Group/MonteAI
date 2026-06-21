// Configuration for pinecone 

using Pinecone;

namespace server.Configuration
{
    public class PineconeConfig
    {
        public const string SectionName = "Pinecone";

        public string ApiKey { get; set; } = string.Empty;

        public string IndexName { get; set; } = string.Empty;

        public string Host { get; set; } = string.Empty;


    }
}