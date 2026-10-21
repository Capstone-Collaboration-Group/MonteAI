// server/Tools/ReingestAllRunner.cs
//
// Bulk METADATA-ONLY re-ingest — runs INSTEAD of the web host (see
// Program.cs, wired AFTER builder.Build() so the full DI container —
// Scrutor repos/services, DbContext, Firestore abstract store, embedding
// client — is available):
//
//   dotnet run --project server -- --reingest-all
//
// Re-runs ThesisService.IngestAsync for every thesis whose SQL status is
// Approved or Indexed. Per thesis that means: resolve authors/year
// (Firestore → research group → SubmittedAt) + latest abstract, delete any
// existing vectors for the thesis (including legacy thesis_*_chunk_* leftovers
// via the prefix scan), and upsert ONE thesis_{id}_meta vector.
//
// Pending/Rejected rows are NEVER touched (moderation is still an admin's
// call — approve those from the desktop panel). Idempotent: safe to re-run
// after catalog edits or whenever the embedding/threshold changes.
//
// Exit code: 0 = every thesis Indexed; 1 = at least one Failed.

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using server.Data;
using server.Models.DTOs.Thesis;
using server.Services.Interfaces;

namespace server.Tools
{
    public static class ReingestAllRunner
    {
        public static async Task<int> RunAsync(IServiceProvider root, string[] args)
        {
            _ = args;

            List<Guid> ids;
            int pending;
            await using (var scope = root.CreateAsyncScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                ids = await db.Theses
                    .Where(t => t.Status == "Indexed" || t.Status == "Approved")
                    .Select(t => t.Id)
                    .ToListAsync();
                pending = await db.Theses.CountAsync(t => t.Status == "Pending");
            }

            Console.WriteLine($"Re-ingesting {ids.Count} Approved/Indexed thesis/these" +
                              (pending > 0 ? $" ({pending} Pending row(s) skipped)" : "") + "…");
            Console.WriteLine();

            var ok = 0;
            var failed = 0;

            foreach (var id in ids)
            {
                try
                {
                    // Fresh scope per thesis: scoped metadata resolver /
                    // abstract store state never leaks between rows.
                    await using var scope = root.CreateAsyncScope();
                    var service = scope.ServiceProvider.GetRequiredService<IThesisService>();

                    var result = await service.IngestAsync(new IngestThesisDto { ThesisId = id });
                    if (result.Status == "Indexed" && result.VectorCount > 0)
                    {
                        ok++;
                        Console.WriteLine($"  OK   {id} ({result.VectorCount} vector)");
                    }
                    else
                    {
                        failed++;
                        Console.WriteLine($"  FAIL {id} (status {result.Status}, {result.VectorCount} vectors)");
                    }
                }
                catch (Exception ex)
                {
                    failed++;
                    Console.WriteLine($"  FAIL {id} ({ex.GetType().Name}: {ex.Message})");
                }
            }

            Console.WriteLine();
            Console.WriteLine($"Done: {ok} indexed, {failed} failed.");
            return failed == 0 ? 0 : 1;
        }
    }
}
