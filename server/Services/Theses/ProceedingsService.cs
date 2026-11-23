using System.Globalization;
using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;
using server.Models.DTOs.Thesis;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.Theses
{
    /// <summary>
    /// Renders the department's "BSIT Capstone Project Defense Proceedings" form —
    /// the 10-section, two-page layout of the attached template (612x936 pt pages,
    /// ruled frame, 8.7 pt body / 11.2 pt headings). Everything the database can
    /// supply is filled in; the rest stays exactly as the template prints it.
    /// Section drawing lives in ProceedingsService.Sections.cs.
    /// </summary>
    public partial class ProceedingsService : IProceedingsService
    {
        private readonly IProceedingsRepository _repository;
        private readonly IAnnotationReader _annotationReader;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<ProceedingsService> _logger;

        public ProceedingsService(
            IProceedingsRepository repository,
            IAnnotationReader annotationReader,
            IWebHostEnvironment environment,
            ILogger<ProceedingsService> logger)
        {
            _repository = repository;
            _annotationReader = annotationReader;
            _environment = environment;
            _logger = logger;
        }

        /// <summary>One printable row of Section V.</summary>
        private sealed record CommentRow(string Member, string Comment, string Response);

        private sealed record CommentBlock(
            string Name,
            string Role,
            IReadOnlyList<ProceedingsAnnotationDto> Comments);

        public async Task<byte[]?> GenerateProceedingsAsync(
            Guid thesisId,
            CancellationToken cancellationToken)
        {
            var data = await _repository.GetProceedingsDataAsync(thesisId, cancellationToken);
            if (data == null)
            {
                _logger.LogWarning("Proceedings requested for unknown thesis {ThesisId}", thesisId);
                return null;
            }

            var annotations = await _annotationReader.ReadAsync(
                thesisId,
                data.VersionIds,
                cancellationToken);
            var blocks = await BuildCommentBlocksAsync(data, annotations, cancellationToken);
            var rows = BuildCommentRows(blocks);

            _logger.LogInformation(
                "Generating proceedings for thesis {ThesisId}: {Members} author(s), {Panelists} panelist(s), {Comments} comment(s)",
                thesisId, data.Members.Count, data.Panelists.Count, annotations.Count);

            using var document = new PdfDocument();

            var renderer = new ProceedingsRenderer(document, LoadHeaderImage());
            try
            {
                DrawProceedings(renderer, data, rows);
            }
            finally
            {
                renderer.Dispose();
            }

            using var stream = new MemoryStream();
            document.Save(stream, false);
            return stream.ToArray();
        }

        public Task<bool> IsStudentThesisMemberAsync(
            Guid thesisId,
            string studentId,
            CancellationToken cancellationToken)
        {
            return _repository.IsStudentThesisMemberAsync(thesisId, studentId, cancellationToken);
        }

        /// <summary>Groups comments per panelist (schedule order first), then any other commenter.</summary>
        private async Task<List<CommentBlock>> BuildCommentBlocksAsync(
            ProceedingsDataDto data,
            IReadOnlyList<ProceedingsAnnotationDto> annotations,
            CancellationToken cancellationToken)
        {
            var blocks = new List<CommentBlock>();
            if (annotations.Count == 0 && data.Panelists.Count == 0) return blocks;

            var byReviewer = annotations
                .GroupBy(a => a.ReviewerId, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

            var claimed = new HashSet<string>(StringComparer.Ordinal);

            foreach (var panelist in data.Panelists)
            {
                byReviewer.TryGetValue(panelist.Id, out var comments);
                blocks.Add(new CommentBlock(panelist.Name, panelist.Role, comments ?? []));
                claimed.Add(panelist.Id);
            }

            var others = byReviewer
                .Where(kv => !claimed.Contains(kv.Key))
                .OrderBy(kv => kv.Value[0].CreatedAt, StringComparer.Ordinal)
                .ToList();

            if (others.Count > 0)
            {
                var names = await _repository.GetDisplayNamesAsync(
                    others.Select(kv => kv.Key),
                    cancellationToken);

                foreach (var (reviewerId, comments) in others)
                {
                    names.TryGetValue(reviewerId, out var name);
                    var role = reviewerId == data.AdviserId ? "Adviser" : "Panelist";
                    blocks.Add(new CommentBlock(name ?? string.Empty, role, comments));
                }
            }

            return blocks;
        }

        /// <summary>Flattens the per-panelist blocks into Section V's rows.</summary>
        private static List<CommentRow> BuildCommentRows(IReadOnlyList<CommentBlock> blocks)
        {
            var rows = new List<CommentRow>();

            foreach (var block in blocks)
            {
                foreach (var annotation in block.Comments)
                {
                    rows.Add(new CommentRow(
                        string.IsNullOrWhiteSpace(block.Name) ? new string('_', 21) : block.Name.Trim(),
                        string.IsNullOrWhiteSpace(annotation.Comment)
                            ? "(no comment)"
                            : annotation.Comment.Trim(),
                        ResponseText(annotation)));
                }
            }

            return rows;
        }

        /// <summary>
        /// Section V's response column: the resolver note itself — no "Resolved:"
        /// prefix, and a resolved comment without a note still prints "Resolved".
        /// </summary>
        private static string ResponseText(ProceedingsAnnotationDto annotation)
        {
            if (!annotation.IsResolved) return string.Empty;
            return string.IsNullOrWhiteSpace(annotation.ResolverNote)
                ? "Resolved"
                : annotation.ResolverNote.Trim();
        }

        private XImage? LoadHeaderImage()
        {
            try
            {
                var path = Path.Combine(
                    _environment.ContentRootPath, "assets", "images", "proceedings-header.png");

                if (!File.Exists(path))
                {
                    _logger.LogWarning("Proceedings header image not found: {Path}", path);
                    return null;
                }

                return XImage.FromFile(path);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load the proceedings header image");
                return null;
            }
        }

        // ── Form values the database cannot hold directly ─────────────────────

        /// <summary>Long date used by Section III, e.g. "October 21, 2026".</summary>
        private static string LongDate(DateOnly date)
            => date.ToString("MMMM dd, yyyy", CultureInfo.InvariantCulture);

        private static string FormatTime(TimeOnly? time)
            => time?.ToString("h:mm tt", CultureInfo.InvariantCulture) ?? Blank(15);

        private static string Blank(int count) => new('_', count);

        /// <summary>
        /// Academic year from the defense date: the Philippine school year runs
        /// June 1 – May 31, so a June-or-later date belongs to year→year+1.
        /// </summary>
        private static string AcademicYear(DateOnly date)
        {
            var start = date.Month >= 6 ? date.Year : date.Year - 1;
            return $"{start}-{start + 1}";
        }

        /// <summary>1st semester June–October, 2nd November–March, summer April–May.</summary>
        private static string Semester(DateOnly date) => date.Month switch
        {
            >= 6 and <= 10 => "1st",
            11 or 12 or 1 or 2 or 3 => "2nd",
            _ => "Summer",
        };

        /// <summary>Panelist role as the template words it ("Panel Chairperson" …).</summary>
        private static string PanelRoleLabel(string? role)
        {
            if (string.IsNullOrWhiteSpace(role)) return "Panel Member";
            if (role.Contains("advis", StringComparison.OrdinalIgnoreCase)) return "Capstone Adviser";
            if (role.Contains("chair", StringComparison.OrdinalIgnoreCase)) return "Panel Chairperson";
            if (role.Contains("member", StringComparison.OrdinalIgnoreCase)) return "Panel Member";
            return role.Trim();
        }

        private static string FillOrBlank(string? value, int blankCount)
            => string.IsNullOrWhiteSpace(value) ? Blank(blankCount) : value.Trim();
    }
}
