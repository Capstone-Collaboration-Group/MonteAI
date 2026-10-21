// server/Models/DTOs/ChatMessage/ChatSourceDto.cs
//
// A single cited source attached to an assistant chat message.
//
// Data flow: retrieved chunks / thesis rows -> ChatSourceDto (in the agent
// service or toolbox) -> serialized into ChatMessage.SourcesJson (Firestore)
// -> deserialized back into ChatMessageResponseDto.Sources -> rendered as the
// "Sources" panel in the web chat UI.
//
// This is what makes MonteAI's answers *provable*: every assistant response
// carries structured provenance, not just inline text citations.

namespace server.Models.DTOs.ChatMessage
{
    public class ChatSourceDto
    {
        /// <summary>Azure SQL identifier of the cited thesis (null when the source came from a partial match).</summary>
        public string? ThesisId { get; set; }

        public string? Title { get; set; }

        public string? Authors { get; set; }

        public string? PublicationYear { get; set; }

        /// <summary>Retrieved text snippet that grounded the answer (already truncated for prompt/UI use).</summary>
        public string? Snippet { get; set; }

        /// <summary>
        /// FULL retrieved text (title/author/year header + complete abstract,
        /// capped at 4000 chars) — consumed ONLY by the synthesizer's sources
        /// block (BuildSourcesBlock). The 600-char Snippet cut abstracts off
        /// before their methodology sentences ("descriptive quantitative …
        /// weighted mean … convenience sampling" sit at the END), so the
        /// synthesizer concluded "no explicit indication" while Pinecone held
        /// the full abstract. JsonIgnore: never persisted to SourcesJson nor
        /// streamed in the SSE sources event — the UI keeps the short Snippet
        /// tooltip and planner observations stay token-budgeted.
        /// </summary>
        [System.Text.Json.Serialization.JsonIgnore]
        public string? FullExcerpt { get; set; }

        /// <summary>Cosine similarity score for vector matches (null for keyword/SQL lookups).</summary>
        public double? Score { get; set; }

        /// <summary>Blob path of the thesis PDF — a fresh SAS URL is minted on demand, this is never a stored SAS link.</summary>
        public string? Url { get; set; }
    }
}
