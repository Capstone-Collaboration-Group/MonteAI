using server.Models.DTOs.ChatMessage;

namespace server.Services.Interfaces
{
    // server/Services/Interfaces/IApaCitationFormatter.cs
    //
    // APA 7th-edition reference formatting for cited chat sources — powers
    // the "Cite" button (copy citation) under assistant messages.
    public interface IApaCitationFormatter
    {
        /// <summary>Formats ONE cited source as an APA 7 reference (plain text, no italics).</summary>
        string FormatApa7(ChatSourceDto source);

        /// <summary>Formats every source, preserving order — pairs 1:1 with the request's sources.</summary>
        IReadOnlyList<string> FormatAll(IReadOnlyList<ChatSourceDto> sources);
    }
}
