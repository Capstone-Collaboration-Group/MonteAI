using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;
using server.Models.DTOs.Thesis;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.Theses
{
    public class ProceedingsService : IProceedingsService
    {
        // Template line-up used only when the thesis has no defense schedule yet.
        private static readonly string[] BlankPanelistRoles = { "Chairman", "Member", "Member", "Member" };

        // Word "Blue, Accent 1, Lighter 40%" - the header shading used on every
        // Comments/Action Taken table in the source template.
        private static readonly XColor HeaderBlue = XColor.FromArgb(156, 194, 230);

        private const double LeftMargin = 50;
        private const double TopMargin = 45;
        private const double BottomMargin = 50;

        private const double HeaderRowHeight = 28;
        private const double MinRowHeight = 30;
        private const double RowPadding = 6;
        private const double TextLineHeight = 13;
        private const double NameLineHeight = 18;
        private const double GapBetweenTables = 20;
        private const int BlankRowsPerTable = 4;

        // Panelist comments live in Firestore - read through IAnnotationReader.
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

        private sealed record CommentBlock(
            string Name,
            string Role,
            IReadOnlyList<ProceedingsAnnotationDto> Comments);

        public async Task<byte[]?> GenerateProceedingsAsync(Guid thesisId)
        {
            var data = await _repository.GetProceedingsDataAsync(thesisId);
            if (data == null)
            {
                _logger.LogWarning("Proceedings requested for unknown thesis {ThesisId}", thesisId);
                return null;
            }

            var annotations = await _annotationReader.ReadAsync(thesisId, data.VersionIds);
            var blocks = await BuildCommentBlocksAsync(data, annotations);

            _logger.LogInformation(
                "Generating proceedings for thesis {ThesisId}: {Members} author(s), {Panelists} panelist(s), {Comments} comment(s)",
                thesisId, data.Members.Count, data.Panelists.Count, annotations.Count);

            var document = new PdfDocument();

            var page = document.AddPage();
            page.Size = PdfSharpCore.PageSize.A4;
            var graphics = XGraphics.FromPdfPage(page);

            double right = page.Width - LeftMargin;
            double y = TopMargin;

            // Fonts
            var schoolFont = new XFont("Arial", 16, XFontStyle.Bold);
            var addressFont = new XFont("Arial", 10, XFontStyle.Regular);
            var titleFont = new XFont("Arial", 12, XFontStyle.Bold);
            var normalFont = new XFont("Arial", 10, XFontStyle.Regular);
            var boldFont = new XFont("Arial", 10, XFontStyle.Bold);
            var tableHeaderFont = new XFont("Arial", 10, XFontStyle.Bold);

            // Starts a new page when the next block won't fit. Returns true when
            // a page break happened, so table callers can redraw the header row.
            bool EnsureSpace(double requiredHeight)
            {
                if (y + requiredHeight <= page.Height - BottomMargin) return false;

                graphics.Dispose();
                page = document.AddPage();
                page.Size = PdfSharpCore.PageSize.A4;
                graphics = XGraphics.FromPdfPage(page);
                right = page.Width - LeftMargin;
                y = TopMargin;
                return true;
            }

            void DrawTableHeader()
            {
                var headerBrush = new XSolidBrush(HeaderBlue);
                double tableWidth = right - LeftMargin;
                double commentsWidth = tableWidth * 0.65;
                double actionWidth = tableWidth * 0.35;

                graphics.DrawRectangle(headerBrush, new XRect(LeftMargin, y, commentsWidth, HeaderRowHeight));
                graphics.DrawRectangle(headerBrush, new XRect(LeftMargin + commentsWidth, y, actionWidth, HeaderRowHeight));
                graphics.DrawRectangle(XPens.Black, new XRect(LeftMargin, y, commentsWidth, HeaderRowHeight));
                graphics.DrawRectangle(XPens.Black, new XRect(LeftMargin + commentsWidth, y, actionWidth, HeaderRowHeight));

                graphics.DrawString(
                    "Comments/Suggestions/Recommendations",
                    tableHeaderFont,
                    XBrushes.Black,
                    new XRect(LeftMargin + 5, y, commentsWidth - 10, HeaderRowHeight),
                    XStringFormats.Center
                );

                graphics.DrawString(
                    "Action Taken",
                    tableHeaderFont,
                    XBrushes.Black,
                    new XRect(LeftMargin + commentsWidth + 5, y, actionWidth - 10, HeaderRowHeight),
                    XStringFormats.Center
                );

                y += HeaderRowHeight;
            }

            void DrawRow(string comment, string action)
            {
                double tableWidth = right - LeftMargin;
                double commentsWidth = tableWidth * 0.65;
                double actionWidth = tableWidth * 0.35;

                var commentLines = WrapText(graphics, comment, normalFont, commentsWidth - 2 * RowPadding);
                var actionLines = WrapText(graphics, action, normalFont, actionWidth - 2 * RowPadding);
                var lineCount = Math.Max(1, Math.Max(commentLines.Count, actionLines.Count));
                var rowHeight = Math.Max(MinRowHeight, lineCount * TextLineHeight + RowPadding * 2);

                // A row that no longer fits ends the current table run - break the
                // page and repeat the header so the continuation stays readable.
                if (y + rowHeight > page.Height - BottomMargin)
                {
                    EnsureSpace(HeaderRowHeight + rowHeight);
                    DrawTableHeader();
                }

                double top = y;
                graphics.DrawRectangle(XPens.Black, new XRect(LeftMargin, top, commentsWidth, rowHeight));
                graphics.DrawRectangle(XPens.Black, new XRect(LeftMargin + commentsWidth, top, actionWidth, rowHeight));

                for (int i = 0; i < commentLines.Count; i++)
                {
                    graphics.DrawString(
                        commentLines[i],
                        normalFont,
                        XBrushes.Black,
                        new XRect(LeftMargin + RowPadding, top + RowPadding + i * TextLineHeight, commentsWidth - 2 * RowPadding, TextLineHeight),
                        XStringFormats.TopLeft
                    );
                }

                for (int i = 0; i < actionLines.Count; i++)
                {
                    graphics.DrawString(
                        actionLines[i],
                        normalFont,
                        XBrushes.Black,
                        new XRect(LeftMargin + commentsWidth + RowPadding, top + RowPadding + i * TextLineHeight, actionWidth - 2 * RowPadding, TextLineHeight),
                        XStringFormats.TopLeft
                    );
                }

                y += rowHeight;
            }

            void DrawCommentBlock(CommentBlock block, bool blankTemplate)
            {
                var nameLine = blankTemplate
                    ? "Mr./Ms. ______________________________"
                    : $"Mr./Ms. {DisplayName(block.Name)} \u2013 {block.Role}";

                EnsureSpace(NameLineHeight + HeaderRowHeight + MinRowHeight + GapBetweenTables);

                graphics.DrawString(nameLine, normalFont, XBrushes.Black, new XPoint(LeftMargin, y));
                y += NameLineHeight;

                DrawTableHeader();

                if (block.Comments.Count == 0)
                {
                    for (int i = 0; i < BlankRowsPerTable; i++)
                        DrawRow(string.Empty, string.Empty);
                }
                else
                {
                    foreach (var annotation in block.Comments)
                    {
                        var comment = string.IsNullOrWhiteSpace(annotation.Comment)
                            ? "(no comment)"
                            : annotation.Comment.Trim();

                        if (annotation.PageNumber > 0)
                            comment += $" (p. {annotation.PageNumber})";

                        var action = !annotation.IsResolved
                            ? string.Empty
                            : string.IsNullOrWhiteSpace(annotation.ResolverNote)
                                ? "Resolved"
                                : $"Resolved: {annotation.ResolverNote.Trim()}";

                        DrawRow(comment, action);
                    }
                }

                y += GapBetweenTables;
            }

            // =========================================================
            // HEADER (seal + school name/address)
            // =========================================================

            double logoSize = 65;
            TryDrawLogo(graphics, LeftMargin, y, logoSize);

            double headerTextLeft = LeftMargin + logoSize + 10;

            graphics.DrawString(
                "COLEGIO DE MONTALBAN",
                schoolFont,
                XBrushes.Black,
                new XRect(headerTextLeft, y + 12, right - headerTextLeft, 22),
                XStringFormats.TopLeft
            );

            graphics.DrawString(
                "Kasiglahan Village, San Jose, Montalban, Rizal",
                addressFont,
                XBrushes.Black,
                new XRect(headerTextLeft, y + 36, right - headerTextLeft, 18),
                XStringFormats.TopLeft
            );

            y += logoSize + 15;

            // =========================================================
            // TITLE BLOCK
            // =========================================================

            graphics.DrawString(
                "DEFENSE PROCEEDINGS",
                titleFont,
                XBrushes.Black,
                new XRect(LeftMargin, y, right - LeftMargin, 20),
                XStringFormats.Center
            );

            y += 20;

            graphics.DrawString(
                "(Final Defense)",
                normalFont,
                XBrushes.Black,
                new XRect(LeftMargin, y, right - LeftMargin, 18),
                XStringFormats.Center
            );

            y += 18;

            graphics.DrawString(
                DateTime.Now.ToString("MMMM dd, yyyy"),
                normalFont,
                XBrushes.Black,
                new XRect(LeftMargin, y, right - LeftMargin, 18),
                XStringFormats.Center
            );

            y += 35;

            // =========================================================
            // NAME / PROGRAM
            // =========================================================

            double nameLabelWidth = graphics.MeasureString("Name:", boldFont).Width;
            double nameValueX = LeftMargin + nameLabelWidth + 6;
            double nameValueWidth = (LeftMargin + 300) - nameValueX - 15;

            double programLabelX = LeftMargin + 300;
            double programLabelWidth = graphics.MeasureString("Program:", boldFont).Width;
            double programValueX = programLabelX + programLabelWidth + 6;
            double programValueWidth = right - programValueX;

            var nameLines = WrapText(
                graphics,
                string.Join(", ", data.Members.Select(m => m.Name)),
                normalFont,
                nameValueWidth);

            if (nameLines.Count == 0) nameLines.Add(string.Empty);

            var programLines = WrapText(
                graphics,
                string.Join(", ", data.Programs),
                normalFont,
                programValueWidth);

            if (programLines.Count == 0) programLines.Add(string.Empty);

            var infoLines = Math.Max(nameLines.Count, programLines.Count);

            EnsureSpace(infoLines * 16 + 24);

            graphics.DrawString("Name:", boldFont, XBrushes.Black, new XPoint(LeftMargin, y));

            for (int i = 0; i < nameLines.Count; i++)
            {
                graphics.DrawString(
                    nameLines[i],
                    normalFont,
                    XBrushes.Black,
                    new XPoint(nameValueX, y + i * 16)
                );
            }

            graphics.DrawString("Program:", boldFont, XBrushes.Black, new XPoint(programLabelX, y));

            for (int i = 0; i < programLines.Count; i++)
            {
                graphics.DrawString(
                    programLines[i],
                    normalFont,
                    XBrushes.Black,
                    new XPoint(programValueX, y + i * 16)
                );
            }

            // Rule under each field, sitting below its last line.
            double infoBaseline = y + (infoLines - 1) * 16;
            double nameBaseline = y + (nameLines.Count - 1) * 16;
            double programBaseline = y + (programLines.Count - 1) * 16;

            graphics.DrawLine(XPens.Black, nameValueX, nameBaseline + 4, nameValueX + nameValueWidth, nameBaseline + 4);
            graphics.DrawLine(XPens.Black, programValueX, programBaseline + 4, right, programBaseline + 4);

            y = infoBaseline + 24;

            // =========================================================
            // WORKING TITLE
            // =========================================================

            graphics.DrawString("Working Title:", boldFont, XBrushes.Black, new XPoint(LeftMargin, y));

            y += 22;

            var titleLines = WrapText(
                graphics,
                data.WorkingTitle ?? string.Empty,
                normalFont,
                right - LeftMargin);

            // The template always shows two ruled lines - keep at least that many.
            while (titleLines.Count < 2) titleLines.Add(string.Empty);

            EnsureSpace(titleLines.Count * 22 + 60);

            foreach (var line in titleLines)
            {
                graphics.DrawString(line, normalFont, XBrushes.Black, new XPoint(LeftMargin, y - 5));
                graphics.DrawLine(XPens.Black, LeftMargin, y, right, y);
                y += 22;
            }

            y += 15;

            // Divider under the student-info block
            graphics.DrawLine(XPens.Black, LeftMargin, y, right, y);
            y += 25;

            // =========================================================
            // PANELISTS
            // =========================================================

            var panelistLines = data.Panelists.Count > 0
                ? data.Panelists.Select(p =>
                    string.IsNullOrWhiteSpace(p.Name)
                        ? $"Mr./Ms. ______________________________ \u2013 {p.Role}"
                        : $"Mr./Ms. {p.Name} \u2013 {p.Role}")
                : BlankPanelistRoles.Select(role => $"Mr./Ms. ______________________________ \u2013 {role}");

            panelistLines = panelistLines.ToList();

            EnsureSpace(20 + panelistLines.Count() * 20 + 10);

            graphics.DrawString("Panelists:", boldFont, XBrushes.Black, new XPoint(LeftMargin, y));
            y += 20;

            foreach (var line in panelistLines)
            {
                graphics.DrawString(line, normalFont, XBrushes.Black, new XPoint(LeftMargin + 20, y));
                y += 20;
            }

            y += 10;

            // =========================================================
            // ADVISER
            // =========================================================

            EnsureSpace(55);

            graphics.DrawString("Adviser:", boldFont, XBrushes.Black, new XPoint(LeftMargin, y));
            y += 20;

            graphics.DrawString(
                string.IsNullOrWhiteSpace(data.AdviserName)
                    ? "Mr./Ms. __________________________________________"
                    : $"Mr./Ms. {data.AdviserName}",
                normalFont,
                XBrushes.Black,
                new XPoint(LeftMargin + 20, y)
            );

            y += 35;

            // =========================================================
            // ONE COMMENTS/ACTION-TAKEN TABLE PER PANELIST
            // =========================================================

            if (blocks.Count > 0)
            {
                foreach (var block in blocks)
                    DrawCommentBlock(block, blankTemplate: false);
            }
            else
            {
                // Nothing scheduled and nothing commented yet - blank template.
                foreach (var _ in BlankPanelistRoles)
                    DrawCommentBlock(new CommentBlock(string.Empty, string.Empty, []), blankTemplate: true);
            }

            // =========================================================
            // APPROVAL
            // =========================================================

            EnsureSpace(220);

            graphics.DrawString("Approved by:", boldFont, XBrushes.Black, new XPoint(LeftMargin, y));
            y += 45;

            DrawSignatureRow(graphics, normalFont, LeftMargin, y, right);
            y += 65;

            DrawSignatureRow(graphics, normalFont, LeftMargin, y, right);
            y += 55;

            // =========================================================
            // NOTED BY
            // =========================================================

            EnsureSpace(70);

            graphics.DrawString("Noted by:", boldFont, XBrushes.Black, new XPoint(LeftMargin, y));
            y += 45;

            graphics.DrawString(
                "_______________________________",
                normalFont,
                XBrushes.Black,
                new XPoint(LeftMargin, y)
            );

            y += 15;

            graphics.DrawString("Research Adviser", normalFont, XBrushes.Black, new XPoint(LeftMargin + 45, y));

            // =========================================================
            // SAVE PDF
            // =========================================================

            graphics.Dispose();

            using var stream = new MemoryStream();
            document.Save(stream, false);
            document.Dispose();
            return stream.ToArray();
        }

        /// <summary>Groups comments per panelist (schedule order first), then any other commenter.</summary>
        private async Task<List<CommentBlock>> BuildCommentBlocksAsync(
            ProceedingsDataDto data,
            IReadOnlyList<ProceedingsAnnotationDto> annotations)
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
                var names = await _repository.GetDisplayNamesAsync(others.Select(kv => kv.Key));

                foreach (var (reviewerId, comments) in others)
                {
                    names.TryGetValue(reviewerId, out var name);
                    var role = reviewerId == data.AdviserId ? "Adviser" : "Panelist";
                    blocks.Add(new CommentBlock(name ?? string.Empty, role, comments));
                }
            }

            return blocks;
        }

        private static string DisplayName(string name)
            => string.IsNullOrWhiteSpace(name) ? "______________________________" : name;

        /// <summary>Greedy word wrap - hard-splits words that are wider than the column.</summary>
        private static List<string> WrapText(XGraphics graphics, string text, XFont font, double maxWidth)
        {
            var lines = new List<string>();

            if (maxWidth <= 0) return lines;

            foreach (var paragraph in (text ?? string.Empty).Replace("\r", string.Empty).Split('\n'))
            {
                var words = paragraph.Split(' ', StringSplitOptions.RemoveEmptyEntries);

                if (words.Length == 0)
                {
                    lines.Add(string.Empty);
                    continue;
                }

                var current = graphics.MeasureString(words[0], font).Width <= maxWidth
                    ? words[0]
                    : HardWrap(graphics, words[0], font, maxWidth, lines);

                for (int i = 1; i < words.Length; i++)
                {
                    var candidate = $"{current} {words[i]}";

                    if (graphics.MeasureString(candidate, font).Width <= maxWidth)
                    {
                        current = candidate;
                        continue;
                    }

                    lines.Add(current);

                    current = graphics.MeasureString(words[i], font).Width <= maxWidth
                        ? words[i]
                        : HardWrap(graphics, words[i], font, maxWidth, lines);
                }

                lines.Add(current);
            }

            return lines;
        }

        private static string HardWrap(XGraphics graphics, string word, XFont font, double maxWidth, List<string> lines)
        {
            var chunk = string.Empty;

            foreach (var ch in word)
            {
                var candidate = chunk + ch;

                if (chunk.Length > 0 && graphics.MeasureString(candidate, font).Width > maxWidth)
                {
                    lines.Add(chunk);
                    chunk = ch.ToString();
                }
                else
                {
                    chunk = candidate;
                }
            }

            return chunk;
        }

        private static void DrawSignatureRow(XGraphics graphics, XFont normalFont, double left, double y, double right)
        {
            double columnWidth = (right - left - 40) / 2;
            double col1 = left + 30;
            double col2 = left + 40 + columnWidth;

            graphics.DrawLine(XPens.Black, col1, y, col1 + columnWidth - 60, y);
            graphics.DrawLine(XPens.Black, col2, y, col2 + columnWidth - 60, y);

            graphics.DrawString(
                "PANEL",
                normalFont,
                XBrushes.Black,
                new XRect(col1, y + 3, columnWidth - 60, 15),
                XStringFormats.Center
            );

            graphics.DrawString(
                "PANEL",
                normalFont,
                XBrushes.Black,
                new XRect(col2, y + 3, columnWidth - 60, 15),
                XStringFormats.Center
            );
        }

        private void TryDrawLogo(XGraphics graphics, double x, double y, double size)
        {
            try
            {
                var logoPath = Path.Combine(
                    _environment.ContentRootPath,
                    "assets",
                    "images",
                    "cdm-logo.png"
                );

                if (!File.Exists(logoPath))
                {
                    _logger.LogWarning("Logo not found: {LogoPath}", logoPath);
                    return;
                }

                using var logo = XImage.FromFile(logoPath);

                graphics.DrawImage(logo, x, y, size, size);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load proceedings logo");
            }
        }
    }
}
