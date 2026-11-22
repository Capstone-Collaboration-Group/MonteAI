using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;

namespace server.Services.Theses
{
    /// <summary>
    /// Drawing primitives for the proceedings form. All public coordinates are
    /// PDF points with y counted from the BOTTOM of the page (the same space the
    /// source template's content stream uses); the y-flip into PdfSharp's
    /// top-down drawing space happens inside <see cref="Text"/> and friends.
    ///
    /// The cursor model is:
    ///   Cursor — baseline the next text line will be drawn on,
    ///   Anchor — baseline of the last thing actually drawn (a rule, a heading
    ///            or the final line of a paragraph), which is what section
    ///            breaks measure their padding from.
    /// </summary>
    internal sealed class ProceedingsRenderer : IDisposable
    {
        // ── Frame + page geometry ─────────────────────────────────────────
        public const double PageWidth = 612;
        public const double PageHeight = 936;

        // The frame is two vertical rails only — the template has no top or
        // bottom horizontal edge; the section rules close the box instead.
        public const double RailLeft = 50.1;
        public const double RailRight = 561.9;
        public const double RailTopFirstPage = 736.2;
        public const double RailTop = 882.7;
        public const double FrameBottomFirstPage = 62.6;
        public const double FrameBottom = 87.2;

        // Section rules overshoot the rails slightly (49.7 → 562.3).
        public const double RuleLeft = 49.7;
        public const double RuleRight = 562.3;

        /// <summary>The final rule always lands here so the box closes on the rail bottom.</summary>
        public const double ClosingRuleY = 87.6;

        public const double TextLeft = 52.4;
        public const double TextRight = 555.6;
        public const double WrapWidth = TextRight - TextLeft;

        /// <summary>First baseline on a page after the first.</summary>
        public const double ContentTop = 874.0;

        // Vertical rhythm, taken off the template's baseline grid.
        public const double BodyStep = 10.0;
        public const double HeadingStep = 13.6;
        public const double RuleGap = 10.9;

        // Section V columns. Text wraps a gutter short of the next column so
        // neighbouring cells never touch (the template's own blanks never come
        // close either).
        public const double ColGutter = 6.0;
        public const double ColMember = 77.8;
        public const double ColComment = 186.9;
        public const double ColResponse = 396.5;
        public const double MemberColWidth = ColComment - ColMember - ColGutter;
        public const double CommentColWidth = ColResponse - ColComment - ColGutter;
        public const double ResponseColWidth = TextRight - ColResponse;

        // Section VIII columns.
        public const double ColAction = 119.6;
        public const double ColResponsible = 254.1;
        public const double ColStatus = 396.5;

        // Shared table columns (designation / score / signature / date).
        public const double ColMiddle = 254.1;
        public const double ColSignature = 396.5;

        private readonly PdfDocument _document;
        private bool _disposed;

        public XGraphics G { get; private set; } = null!;
        public PdfPage Page { get; private set; } = null!;
        public int PageNumber { get; private set; }

        /// <summary>Baseline the next line is drawn on.</summary>
        public double Cursor { get; set; }

        /// <summary>Baseline of the last drawn element.</summary>
        public double Anchor { get; set; }

        // ── Fonts (the template is an 8.7 pt sans body with 11.2 pt headings) ──
        public XFont Heading { get; } = new XFont("Arial", 11.2, XFontStyle.Bold);
        public XFont Body { get; } = new XFont("Arial", 8.7, XFontStyle.Regular);
        public XFont BodyBold { get; } = new XFont("Arial", 8.7, XFontStyle.Bold);
        public XFont Info { get; } = new XFont("Arial", 10.4, XFontStyle.Regular);
        public XFont InfoBold { get; } = new XFont("Arial", 10.4, XFontStyle.Bold);
        public XFont Mid { get; } = new XFont("Arial", 9.5, XFontStyle.Regular);
        public XFont Small { get; } = new XFont("Arial", 7.8, XFontStyle.Regular);
        public XFont TitleProbe { get; } = new XFont("Arial", 12, XFontStyle.Bold);

        private static readonly XPen FramePen = new XPen(XBrushes.Black, 1.0);
        private static readonly XPen RulePen = new XPen(XBrushes.Black, 0.8);
        private static readonly XPen BoxPen = new XPen(XBrushes.Black, 0.8);
        private static readonly XPen CheckPen = new XPen(XBrushes.Black, 0.6);

        private double Bottom => PageNumber <= 1 ? FrameBottomFirstPage : FrameBottom;

        public ProceedingsRenderer(PdfDocument document, XImage? headerImage)
        {
            _document = document;
            HeaderImage = headerImage;
            StartPage(first: true);
        }

        public XImage? HeaderImage { get; }

        /// <summary>The 1231x240 crop of both seals + the blackletter school name.</summary>
        public void DrawHeaderStrip(double imageTopPdf = 876.7)
        {
            if (HeaderImage == null) return;
            G.DrawImage(HeaderImage, 90.3, PageHeight - imageTopPdf, 432.95, 73.65);
        }

        public void NewPage() => StartPage(first: false);

        private void StartPage(bool first)
        {
            if (G != null) G.Dispose();

            PageNumber = first ? 1 : PageNumber + 1;
            Page = _document.AddPage();
            Page.Width = PageWidth;
            Page.Height = PageHeight;
            G = XGraphics.FromPdfPage(Page);

            DrawFrame();
            Cursor = ContentTop;
            Anchor = ContentTop;
        }

        private void DrawFrame()
        {
            // Rails only: open at the top and bottom on page 1 (the header block
            // and the first rule close it), closed top-open on later pages.
            double top = PageNumber <= 1 ? RailTopFirstPage : RailTop;
            double bottom = PageNumber <= 1 ? FrameBottomFirstPage : FrameBottom;
            G.DrawLine(FramePen, RailLeft, PageHeight - top, RailLeft, PageHeight - bottom);
            G.DrawLine(FramePen, RailRight, PageHeight - top, RailRight, PageHeight - bottom);
        }

        /// <summary>True when a baseline sits far enough above the frame bottom.</summary>
        public bool Fits(double y) => y >= Bottom + 1;

        /// <summary>Returns <paramref name="y"/>, or the top of a fresh page when it does not fit.</summary>
        public double Fit(double y)
        {
            if (Fits(y)) return y;
            NewPage();
            return Cursor;
        }

        /// <summary>Makes room for a block of <paramref name="height"/> below the cursor.</summary>
        public void EnsureRoom(double height)
        {
            if (Cursor - height >= Bottom + 1) return;
            NewPage();
        }

        public void SetCursor(double y) => Cursor = y;

        /// <summary>Sets both cursor and anchor (used after drawing a multi-line block by hand).</summary>
        public void MoveTo(double y)
        {
            Cursor = y;
            Anchor = y;
        }

        /// <summary>
        /// Leaves the cursor <paramref name="distance"/> below the last drawn line,
        /// breaking to a fresh page when that would cross the frame bottom, and
        /// returns the baseline to draw on next.
        /// </summary>
        public double Next(double distance)
        {
            Space(distance);
            Cursor = Fit(Cursor);
            return Cursor;
        }

        /// <summary>Draws <paramref name="text"/> at <paramref name="x"/>, shrinking the font when it would overrun <paramref name="maxWidth"/>.</summary>
        public void TextFitted(string text, XFont font, double x, double y, double maxWidth, XFontStyle style = XFontStyle.Regular)
        {
            var width = Measure(text, font);
            if (width > maxWidth && width > 0)
                font = new XFont("Arial", Math.Max(6.5, font.Size * maxWidth / width), style);

            Text(text, font, x, y);
        }

        /// <summary>Vertical rule that does not move the cursor (section IV column divider, remarks box edge).</summary>
        public void DrawVertical(double x, double top, double bottom)
        {
            G.DrawLine(RulePen, x, PageHeight - top, x, PageHeight - bottom);
        }

        /// <summary>Horizontal segment that does not move the cursor (remarks box edges).</summary>
        public void DrawHorizontal(double y, double x1, double x2)
        {
            G.DrawLine(RulePen, x1, PageHeight - y, x2, PageHeight - y);
        }

        public void Text(string text, XFont font, double x, double y)
        {
            if (!string.IsNullOrEmpty(text))
                G.DrawString(text, font, XBrushes.Black, new XPoint(x, PageHeight - y));

            Cursor = y;
            Anchor = y;
        }

        /// <summary>Leaves the cursor so the next line sits <paramref name="distance"/> below the last drawn one.</summary>
        public void Space(double distance) => Cursor = Anchor - distance;

        public void DrawHeading(string text) => DrawHeading(text, HeadingStep);

        public void DrawHeading(string text, double stepAfter)
        {
            var y = Fit(Cursor);
            Text(text, Heading, TextLeft, y);
            Cursor -= stepAfter;
        }

        /// <summary>Wrapped paragraph starting at the cursor; 10 pt between lines.</summary>
        public void Paragraph(string text, XFont font, double x, double width, double step = BodyStep)
        {
            foreach (var line in Wrap(text, font, width))
            {
                var y = Fit(Cursor);
                Text(line, font, x, y);
                Cursor -= step;
            }
        }

        /// <summary>Blank space the size of <paramref name="lines"/> body lines.</summary>
        public void BlankLines(int lines) => Cursor -= lines * BodyStep;

        /// <summary>
        /// Rule that separates two sections. Leaves the cursor on the heading
        /// baseline of the next one — or at the top of a fresh page when the
        /// heading no longer fits.
        /// </summary>
        public void SectionBreak(double padding)
        {
            var ruleY = Anchor - padding;
            if (ruleY >= Bottom)
            {
                DrawRule(ruleY);
                var headingY = ruleY - RuleGap;
                if (Fits(headingY))
                {
                    Cursor = headingY;
                    return;
                }
            }

            NewPage();
        }

        /// <summary>Final rule, pinned to the rail bottom so the frame always closes.</summary>
        public void ClosingRule() => DrawRule(ClosingRuleY);

        public void DrawRule(double y)
        {
            G.DrawLine(RulePen, RuleLeft, PageHeight - y, RuleRight, PageHeight - y);
            Cursor = y;
            Anchor = y;
        }

        /// <summary>
        /// Outlined square standing in for the template's U+2610 checkbox: a ~6 pt
        /// ink box whose foot sits on the baseline, offset ~1.4 pt right of the
        /// column x (the glyph's left side bearing in the source PDF).
        /// </summary>
        public void CheckBox(double x, double baseline, double size = 6.4)
        {
            const double bearing = 1.35;
            var half = CheckPen.Width / 2.0;
            var path = size - CheckPen.Width;
            G.DrawRectangle(
                CheckPen,
                x + bearing + half,
                PageHeight - (baseline + size - 0.5),
                path,
                path);
        }

        /// <summary>Rectangle outline; the cursor ends on its bottom edge.</summary>
        public void Box(double x, double top, double width, double height)
        {
            G.DrawRectangle(BoxPen, x, PageHeight - top, width, height);
            Cursor = top - height;
            Anchor = top - height;
        }

        public double Measure(string text, XFont font)
            => string.IsNullOrEmpty(text) ? 0 : G.MeasureString(text, font).Width;

        /// <summary>Greedy word wrap; hard-splits words wider than the column.</summary>
        public List<string> Wrap(string text, XFont font, double maxWidth)
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

                var current = Measure(words[0], font) <= maxWidth
                    ? words[0]
                    : HardWrap(words[0], font, maxWidth, lines);

                foreach (var word in words.Skip(1))
                {
                    var candidate = $"{current} {word}";
                    if (Measure(candidate, font) <= maxWidth)
                    {
                        current = candidate;
                        continue;
                    }

                    lines.Add(current);
                    current = Measure(word, font) <= maxWidth
                        ? word
                        : HardWrap(word, font, maxWidth, lines);
                }

                lines.Add(current);
            }

            return lines;
        }

        private string HardWrap(string word, XFont font, double maxWidth, List<string> lines)
        {
            var chunk = string.Empty;
            foreach (var ch in word)
            {
                var candidate = chunk + ch;
                if (chunk.Length > 0 && Measure(candidate, font) > maxWidth)
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

        /// <summary>Shrinks the font when the text would run past <paramref name="maxWidth"/>.</summary>
        public void RightAligned(string text, XFont font, double rightEdge, double y, double maxWidth)
        {
            var size = font.Size;
            var width = Measure(text, font);
            if (width > maxWidth && width > 0)
            {
                size = Math.Max(6.5, size * maxWidth / width);
                font = new XFont("Arial", size, XFontStyle.Regular);
                width = Measure(text, font);
            }

            Text(text, font, rightEdge - width, y);
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            G?.Dispose();
            HeaderImage?.Dispose();
        }
    }
}
