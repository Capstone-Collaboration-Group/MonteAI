using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;
using server.Services.Interfaces;

namespace server.Services.Theses
{
    public class ProceedingsService : IProceedingsService
    {

        private readonly IWebHostEnvironment _environment;

        public ProceedingsService(IWebHostEnvironment environment)
        {
            _environment = environment;
        }
        // Path to the CdM seal used in the header. Copy assets/cdm-logo.png into
        // your project (e.g. wwwroot/assets/cdm-logo.png) and update this path,
        // or inject it via configuration instead of hard-coding it.
        private const string LogoPath = "./assets/images/cdm-logo.png";

        // Panel is a fixed size in this template: Chairman + 3 Members.
        private static readonly string[] PanelistRoles = { "Chairman", "Member", "Member", "Member" };

        // Word "Blue, Accent 1, Lighter 40%" — the header shading used on every
        // Comments/Action Taken table in the source template.
        private static readonly XColor HeaderBlue = XColor.FromArgb(156, 194, 230);

        private const double LeftMargin = 50;
        private const double TopMargin = 45;
        private const double BottomMargin = 50;

        public Task<byte[]> GenerateProceedingsAsync(Guid thesisId)
        {

            Console.WriteLine("====================================");
            Console.WriteLine("NEW PROCEEDINGS SERVICE IS RUNNING");
            Console.WriteLine($"Thesis ID: {thesisId}");
            Console.WriteLine("====================================");
            
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

            DrawLabelWithBlank(graphics, boldFont, normalFont, "Name:", LeftMargin, y, 230);
            DrawLabelWithBlank(graphics, boldFont, normalFont, "Program:", LeftMargin + 300, y, 200);

            y += 20;

            // =========================================================
            // WORKING TITLE
            // =========================================================

            graphics.DrawString("Working Title:", boldFont, XBrushes.Black, new XPoint(LeftMargin, y));

            y += 22;

            graphics.DrawLine(XPens.Black, LeftMargin, y, right, y);
            y += 22;

            graphics.DrawLine(XPens.Black, LeftMargin, y, right, y);
            y += 15;

            // Divider under the student-info block
            graphics.DrawLine(XPens.Black, LeftMargin, y, right, y);
            y += 25;

            // =========================================================
            // PANELISTS
            // =========================================================

            graphics.DrawString("Panelists:", boldFont, XBrushes.Black, new XPoint(LeftMargin, y));
            y += 20;

            foreach (var role in PanelistRoles)
            {
                graphics.DrawString(
                    $"Mr./Ms. ______________________________ \u2013 {role}",
                    normalFont,
                    XBrushes.Black,
                    new XPoint(LeftMargin + 20, y)
                );
                y += 20;
            }

            y += 10;

            // =========================================================
            // ADVISER
            // =========================================================

            graphics.DrawString("Adviser:", boldFont, XBrushes.Black, new XPoint(LeftMargin, y));
            y += 20;

            graphics.DrawString(
                "Mr./Ms. __________________________________________",
                normalFont,
                XBrushes.Black,
                new XPoint(LeftMargin + 20, y)
            );

            y += 35;

            // =========================================================
            // ONE COMMENTS/ACTION-TAKEN TABLE PER PANELIST
            // =========================================================

            double tableWidth = right - LeftMargin;
            double commentsWidth = tableWidth * 0.65;
            double actionWidth = tableWidth * 0.35;
            const double headerRowHeight = 28;
            const double blankRowHeight = 30;
            const int blankRowsPerTable = 4;
            const double nameLineHeight = 18;
            const double gapBetweenTables = 20;

            double tableBlockHeight = nameLineHeight + headerRowHeight + (blankRowHeight * blankRowsPerTable);

            for (int i = 0; i < PanelistRoles.Length; i++)
            {
                EnsureSpace(document, ref page, ref graphics, ref y, tableBlockHeight + gapBetweenTables, ref right);

                // Panelist name line above their table
                graphics.DrawString(
                    "Mr./Ms. ______________________________",
                    normalFont,
                    XBrushes.Black,
                    new XPoint(LeftMargin, y)
                );
                y += nameLineHeight;

                DrawCommentsTable(
                    graphics,
                    tableHeaderFont,
                    LeftMargin,
                    y,
                    commentsWidth,
                    actionWidth,
                    headerRowHeight,
                    blankRowHeight,
                    blankRowsPerTable
                );

                y += headerRowHeight + (blankRowHeight * blankRowsPerTable) + gapBetweenTables;
            }

            // =========================================================
            // APPROVAL
            // =========================================================

            EnsureSpace(document, ref page, ref graphics, ref y, 220, ref right);

            graphics.DrawString("Approved by:", boldFont, XBrushes.Black, new XPoint(LeftMargin, y));
            y += 45;

            DrawSignatureRow(graphics, normalFont, LeftMargin, y, right);
            y += 65;

            DrawSignatureRow(graphics, normalFont, LeftMargin, y, right);
            y += 55;

            // =========================================================
            // NOTED BY
            // =========================================================

            EnsureSpace(document, ref page, ref graphics, ref y, 70, ref right);

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

            using var stream = new MemoryStream();
            document.Save(stream, false);
            return Task.FromResult(stream.ToArray());
            
        }

        private static void DrawLabelWithBlank(
            XGraphics graphics,
            XFont boldFont,
            XFont normalFont,
            string label,
            double x,
            double y,
            double blankWidth)
        {
            graphics.DrawString(label, boldFont, XBrushes.Black, new XPoint(x, y));
            double labelWidth = graphics.MeasureString(label, boldFont).Width;
            graphics.DrawLine(XPens.Black, x + labelWidth + 6, y + 2, x + labelWidth + 6 + blankWidth, y + 2);
            _ = normalFont; // reserved for filling in the value once bound to real data
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

        private static void DrawCommentsTable(
            XGraphics graphics,
            XFont tableHeaderFont,
            double left,
            double y,
            double commentsWidth,
            double actionWidth,
            double headerRowHeight,
            double blankRowHeight,
            int blankRows)
        {
            var headerBrush = new XSolidBrush(HeaderBlue);

            // Header row (shaded)
            graphics.DrawRectangle(headerBrush, new XRect(left, y, commentsWidth, headerRowHeight));
            graphics.DrawRectangle(headerBrush, new XRect(left + commentsWidth, y, actionWidth, headerRowHeight));
            graphics.DrawRectangle(XPens.Black, new XRect(left, y, commentsWidth, headerRowHeight));
            graphics.DrawRectangle(XPens.Black, new XRect(left + commentsWidth, y, actionWidth, headerRowHeight));

            graphics.DrawString(
                "Comments/Suggestions/Recommendations",
                tableHeaderFont,
                XBrushes.Black,
                new XRect(left + 5, y, commentsWidth - 10, headerRowHeight),
                XStringFormats.Center
            );

            graphics.DrawString(
                "Action Taken",
                tableHeaderFont,
                XBrushes.Black,
                new XRect(left + commentsWidth + 5, y, actionWidth - 10, headerRowHeight),
                XStringFormats.Center
            );

            double rowY = y + headerRowHeight;

            for (int i = 0; i < blankRows; i++)
            {
                graphics.DrawRectangle(XPens.Black, new XRect(left, rowY, commentsWidth, blankRowHeight));
                graphics.DrawRectangle(XPens.Black, new XRect(left + commentsWidth, rowY, actionWidth, blankRowHeight));
                rowY += blankRowHeight;
            }
        }

        /// <summary>
        /// Starts a new page (and resets the running y-coordinate) if the next block
        /// won't fit above the bottom margin on the current page.
        /// </summary>
        private static void EnsureSpace(
            PdfDocument document,
            ref PdfPage page,
            ref XGraphics graphics,
            ref double y,
            double requiredHeight,
            ref double right)
        {
            if (y + requiredHeight <= page.Height - BottomMargin)
            {
                return;
            }

            graphics.Dispose();
            page = document.AddPage();
            page.Size = PdfSharpCore.PageSize.A4;
            graphics = XGraphics.FromPdfPage(page);
            right = page.Width - LeftMargin;
            y = TopMargin;
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
            Console.WriteLine($"Logo not found: {logoPath}");
            return;
        }

        using var logo = XImage.FromFile(logoPath);

        graphics.DrawImage(
            logo,
            x,
            y,
            size,
            size
        );
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Failed to load logo: {ex.Message}");
    }
}
    }
}