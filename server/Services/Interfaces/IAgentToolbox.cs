using System.Text.Json;
using server.Models.DTOs.ChatMessage;
using server.Models.Agent;

// server/Services/Interfaces/IAgentToolbox.cs
//
// The set of tools the MonteAI agent can invoke. The planner discovers the
// tools through <see cref="GetToolManifest"/> (a prompt-ready description
// with JSON argument shapes) and executes them via <see cref="ExecuteAsync"/>,
// which returns both a textual observation (fed back to the planner) and the
// structured citations that end up attached to the final answer.

namespace server.Services.Interfaces
{
    public interface IAgentToolbox
    {
        /// <summary>Prompt-ready manifest of every tool and its argument schema.</summary>
        string GetToolManifest();

        /// <summary>Executes one tool by name. Unknown names yield a corrective observation instead of throwing.</summary>
        Task<ToolExecutionResult> ExecuteAsync(string toolName, JsonElement? arguments, CancellationToken cancellationToken = default);
    }
}
