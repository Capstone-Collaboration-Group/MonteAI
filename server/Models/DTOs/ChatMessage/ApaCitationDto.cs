// server/Models/DTOs/ChatMessage/ApaCitationDto.cs
//
// Request/response contracts for POST /api/v1/chat/citations/apa — the
// "Cite" button's copyable APA 7 references.

namespace server.Models.DTOs.ChatMessage
{
    public class ApaCitationRequestDto
    {
        /// <summary>The message's persisted sources, in [Source n] order.</summary>
        public List<ChatSourceDto> Sources { get; set; } = [];
    }

    public class ApaCitationDto
    {
        /// <summary>Cited thesis id (null for partial matches) — lets the UI pair rows with sources.</summary>
        public string? ThesisId { get; set; }

        public string Citation { get; set; } = string.Empty;
    }

    public class ApaCitationResponseDto
    {
        public List<ApaCitationDto> Citations { get; set; } = [];
    }
}
