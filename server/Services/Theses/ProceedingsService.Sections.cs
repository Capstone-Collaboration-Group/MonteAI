using System.Globalization;
using PdfSharpCore.Drawing;
using server.Models.DTOs.Thesis;
using static server.Services.Theses.ProceedingsRenderer;

namespace server.Services.Theses
{
    /// <summary>
    /// Section drawing for the proceedings form — a line-by-line transcription of
    /// the department's 10-section template. Prose keeps the template's own line
    /// breaks (each visual line is drawn on its own baseline); only the blanks the
    /// database can supply are filled in. Every section measures its spacing from
    /// the previous one, so a shorter panel or a longer comment table simply shifts
    /// what follows instead of colliding with it.
    /// </summary>
    public partial class ProceedingsService
    {
        // ── Template geometry (PDF points, y counted from the page bottom) ────
        private const double ScheduleRightEdge = 553.9;   // right-aligned schedule column
        private const double ScheduleWidth = 370.0;       // its widest permitted line
        private const double InfoX = 321.3;               // section I right column / IV right labels
        private const double DividerX = 319.0;            // section IV column divider
        private const double NameX = 63.7;                // section V member cell
        private const double NameWidth = ColComment - NameX - ColGutter;
        private const double RightWrap = WrapWidth;       // longest line the template prints
        private const double RemarksLeft = 251.4;
        private const double DocControlY = 129.7;         // pinned so the closing rule lands on 87.6
        private const double MinLastRowY = 140.0;         // section X rows clear this, or Document Control would overlap

        /// <summary>Runs the whole form: header block, the ten sections, document control.</summary>
        private void DrawProceedings(
            ProceedingsRenderer r,
            ProceedingsDataDto data,
            IReadOnlyList<CommentRow> rows)
        {
            DrawHeader(r, data);
            DrawDefenseInformation(r, data);

            r.SectionBreak(10.9);
            DrawPanelComposition(r, data);

            r.SectionBreak(15.4);
            DrawOpening(r, data);

            r.SectionBreak(15.5);
            DrawSummary(r);

            r.SectionBreak(28.8);
            DrawQuestions(r, rows);

            r.SectionBreak(38.8);
            DrawEvaluation(r);

            r.SectionBreak(5.5);
            DrawDecision(r);

            r.SectionBreak(5.5);
            DrawRequiredRevisions(r);

            r.SectionBreak(13.3);
            DrawClosing(r, data);

            r.SectionBreak(15.3);
            DrawAcknowledgment(r, data);

            // No rule between X and Document Control — the block is pinned so the
            // closing rule always finishes the frame at the rail bottom.
            DrawDocumentControl(r, data);
            r.ClosingRule();
        }

        // ── Header block (always page 1) ──────────────────────────────────────

        private static void DrawHeader(ProceedingsRenderer r, ProceedingsDataDto data)
        {
            r.DrawHeaderStrip(876.7);
            DrawDocumentTitle(r);
            DrawScheduleBlock(r, data);
            r.DrawRule(735.9);
            r.SetCursor(725.0);
        }

        /// <summary>Centred running title, auto-fit to the template's 277.5 pt measure.</summary>
        private static void DrawDocumentTitle(ProceedingsRenderer r)
        {
            const string title = "BSIT CAPSTONE PROJECT DEFENSE PROCEEDINGS";
            const double centerX = 306.0;
            const double baseline = 807.0;
            const double maxWidth = 277.5;

            var font = r.Heading;
            var width = r.Measure(title, font);
            if (width > maxWidth && width > 0)
                font = new XFont("Arial", Math.Max(7.0, 11.2 * maxWidth / width), XFontStyle.Bold);

            r.Text(title, font, centerX - r.Measure(title, font) / 2.0, baseline);
        }

        /// <summary>Date / time / venue at the right, academic year and semester at the left.</summary>
        private static void DrawScheduleBlock(ProceedingsRenderer r, ProceedingsDataDto data)
        {
            var date = data.DefenseDate.HasValue ? LongDate(data.DefenseDate.Value) : Blank(15);

            ScheduleLine(r, $"Date: {date}", 778.0);
            ScheduleLine(r, $"Time Started: {FormatTime(data.StartTime)}", 764.7);
            ScheduleLine(r, $"Time Ended: {FormatTime(data.EndingTime)}", 751.4);
            ScheduleLine(r, $"Venue / Platform: {FillOrBlank(data.RoomVenue, 15)}", 738.1);

            InfoPair(
                r,
                "Academic Year:",
                data.DefenseDate.HasValue ? AcademicYear(data.DefenseDate.Value) : Blank(10),
                765.1);
            InfoPair(
                r,
                "Semester:",
                data.DefenseDate.HasValue ? Semester(data.DefenseDate.Value) : Blank(10),
                751.7);
        }

        /// <summary>10.4 pt label plus bold value, one space apart.</summary>
        private static void InfoPair(ProceedingsRenderer r, string label, string value, double y)
        {
            r.Text(label, r.Info, TextLeft, y);
            r.Text(value, r.InfoBold, TextLeft + r.Measure(label, r.Info) + r.Measure(" ", r.Info), y);
        }

        private static void ScheduleLine(ProceedingsRenderer r, string text, double y)
            => r.RightAligned(text, r.Body, ScheduleRightEdge, y, ScheduleWidth);

        // ── I. Defense information ────────────────────────────────────────────

        private static void DrawDefenseInformation(ProceedingsRenderer r, ProceedingsDataDto data)
        {
            r.DrawHeading("I. DEFENSE INFORMATION", 13.6);          // 725.0 → 711.4
            r.Text("Type of Defense:", r.BodyBold, TextLeft, r.Cursor);

            // All four boxes stay unchecked, exactly as the form prints them.
            CheckPair(r, 698.1, "Title Defense", 63.7, "System Validation", 198.2);
            CheckPair(r, 684.8, "Oral/Proposal Defense", 63.7, "Final Defense", 198.2);

            r.Text($"Section / Year Level: {FillOrBlank(data.SectionYearLevel, 25)}", r.Mid, InfoX, 685.0);
            r.Text($"Capstone Adviser: {FillOrBlank(data.AdviserName, 27)}", r.Mid, InfoX, 667.7);

            // Title sits on the label's own line, shrunk to the width left over.
            r.Text("Project Title:", r.BodyBold, TextLeft, 648.9);
            var x = TextLeft + r.Measure("Project Title:", r.BodyBold) + r.Measure(" ", r.Body);
            r.TextFitted(FillOrBlank(data.WorkingTitle, 50), r.Body, x, 648.9, TextRight - x);
        }

        /// <summary>Two unchecked boxes with bold labels on one baseline.</summary>
        private static void CheckPair(
            ProceedingsRenderer r,
            double y,
            string left,
            double leftX,
            string right,
            double rightX)
        {
            r.CheckBox(TextLeft, y);
            r.Text(left, r.BodyBold, leftX, y);
            r.CheckBox(ColComment, y);
            r.Text(right, r.BodyBold, rightX, y);
        }

        // ── II. Panel composition ─────────────────────────────────────────────

        private static void DrawPanelComposition(ProceedingsRenderer r, ProceedingsDataDto data)
        {
            r.DrawHeading("II. PANEL COMPOSITION", 13.6);           // 627.2 → 613.6

            var y = r.Fit(r.Cursor);
            r.Text("Name", r.BodyBold, TextLeft, y);
            r.Text("Designation / Role", r.BodyBold, ColMiddle, y);
            r.Text("Signature", r.BodyBold, ColSignature, y);

            foreach (var (name, designation) in BuildPanelRows(data))
            {
                r.Space(13.3);
                y = r.Fit(r.Cursor);
                r.Text(name, r.Body, TextLeft, y);
                r.Text(designation, r.Body, ColMiddle, y);
                r.Text(Blank(17), r.Body, ColSignature, y);
            }
        }

        /// <summary>
        /// The panelists of the scheduled defense, with the capstone adviser signing
        /// last; without a schedule the template's four printed rows are used.
        /// </summary>
        private static List<(string Name, string Designation)> BuildPanelRows(ProceedingsDataDto data)
        {
            if (data.Panelists.Count == 0)
            {
                return
                [
                    (Blank(27), "Panel Chairperson"),
                    (Blank(27), "Panel Member"),
                    (Blank(27), "Panel Member"),
                    (FillOrBlank(data.AdviserName, 27), "Capstone Adviser"),
                ];
            }

            var rows = data.Panelists
                .Select(panelist => (FillOrBlank(panelist.Name, 27), PanelRoleLabel(panelist.Role)))
                .ToList();

            var hasAdviser = data.Panelists.Any(panelist =>
                panelist.Role.Contains("advis", StringComparison.OrdinalIgnoreCase));

            if (!hasAdviser && !string.IsNullOrWhiteSpace(data.AdviserName))
                rows.Add((data.AdviserName.Trim(), "Capstone Adviser"));

            return rows;
        }

        // ── III. Opening of the proceedings ───────────────────────────────────

        private static void DrawOpening(ProceedingsRenderer r, ProceedingsDataDto data)
        {
            r.DrawHeading("III. OPENING OF THE PROCEEDINGS", 13.6);  // 534.0 → 520.4

            var time = data.StartTime?.ToString("h:mm tt", CultureInfo.InvariantCulture) ?? Blank(10);
            var date = data.DefenseDate.HasValue ? LongDate(data.DefenseDate.Value) : Blank(18);
            var venue = FillOrBlank(data.RoomVenue, 18);

            LineFitted(
                r,
                $"The capstone project defense commenced at {time} on {date}, at {venue}",
                r.Body,
                TextLeft,
                15.3,
                RightWrap);

            Line(
                r,
                "The Panel Chairperson formally opened the proceedings and introduced the members of the panel. The proponents were instructed",
                r.Body,
                TextLeft,
                10.0);
            Line(
                r,
                "to present their project and respond to the questions, comments, and recommendations of the panel.",
                r.Body,
                TextLeft,
                15.3);
            Line(r, "The proponents presented their project entitled:", r.Body, TextLeft, 20.0);

            LineFitted(r, $"“{TitleQuoted(data)}”", r.Body, TextLeft, 10.7, RightWrap);

            Line(
                r,
                "The presentation covered the background of the project, statement of the problem, objectives, scope and",
                r.Body,
                TextLeft,
                9.9);
            Line(
                r,
                "limitations, significance, related literature and studies, methodology, proposed or developed IT solution, and",
                r.Body,
                TextLeft,
                10.0);
            Line(
                r,
                "other relevant components appropriate to the stage of the defense.",
                r.Body,
                TextLeft,
                10.0);
        }

        /// <summary>Working title for the quotation line, or the printed 88-blank run.</summary>
        private static string TitleQuoted(ProceedingsDataDto data)
            => string.IsNullOrWhiteSpace(data.WorkingTitle) ? Blank(88) : data.WorkingTitle.Trim();

        // ── IV. Summary of the project presentation ───────────────────────────

        private static void DrawSummary(ProceedingsRenderer r)
        {
            r.DrawHeading("IV. SUMMARY OF THE PROJECT PRESENTATION", 22.2);   // 402.9 → 380.7

            Line(
                r,
                "Briefly summarize the key points presented by the proponents under each applicable subsection. Record only the information",
                r.Body,
                TextLeft,
                10.0);
            Line(
                r,
                "actually presented during the defense. Use concise, objective statements and avoid inserting personal opinions, evaluation scores,",
                r.Body,
                TextLeft,
                10.0);
            Line(
                r,
                "or panel recommendations in this section. Record the panel's questions, comments, and required revisions separately in Section V.",
                r.Body,
                TextLeft,
                25.4);

            r.DrawVertical(DividerX, 346.8, 256.3);

            LabelPair(r, "A. Background and Rationale", "D. Proposed Solution / System Description");
            r.Space(37.3);
            LabelPair(r, "B. Statement of the Problem / Identified Need", "E. Methodology and Technical Approach");
            r.Space(39.3);
            LabelPair(r, "C. General and Specific Objectives", "F. Scope, Limitations, and Intended Beneficiaries");
        }

        /// <summary>Bold left/right label pair sharing one baseline.</summary>
        private static void LabelPair(ProceedingsRenderer r, string left, string right)
        {
            var y = r.Fit(r.Cursor);
            r.Text(left, r.BodyBold, TextLeft, y);
            r.Text(right, r.BodyBold, InfoX, y);
        }

        // ── V. Panel questions, comments, and recommendations ─────────────────

        private static void DrawQuestions(ProceedingsRenderer r, IReadOnlyList<CommentRow> rows)
        {
            r.DrawHeading("V. PANEL QUESTIONS, COMMENTS, AND RECOMMENDATIONS", 13.5);   // 219.1 → 205.6
            DrawQuestionsHeader(r);

            var blanks = rows.Count == 0;
            var count = blanks ? 5 : rows.Count;

            // The template's own row rhythm, so an untouched table matches the form.
            double[] rowGaps = { 15.3, 14.7, 16.0, 13.9, 16.0 };

            for (var i = 0; i < count; i++)
            {
                r.Space(i < rowGaps.Length ? rowGaps[i] : 15.2);

                if (blanks)
                {
                    var blankY = r.Fit(r.Cursor);
                    r.Text($"{i + 1} {Blank(23)}", r.Body, TextLeft, blankY);
                    r.Text(Blank(34), r.Body, ColComment, blankY);
                    r.Text(Blank(32), r.Body, ColResponse, blankY);
                    continue;
                }

                var row = rows[i];
                var name = r.Wrap(row.Member, r.Body, NameWidth);
                var comment = r.Wrap(row.Comment, r.Body, CommentColWidth);
                var response = r.Wrap(row.Response, r.Body, ResponseColWidth);
                var lines = Math.Max(name.Count, Math.Max(comment.Count, response.Count));

                // Break the page (column header and all) when the row would run off it.
                if (!r.Fits(r.Cursor - (lines - 1) * BodyStep))
                {
                    r.NewPage();
                    DrawQuestionsHeader(r);
                    r.Space(15.3);
                }

                var first = r.Cursor;
                for (var k = 0; k < lines; k++)
                {
                    var lineY = first - k * BodyStep;
                    if (k == 0) r.Text((i + 1).ToString(CultureInfo.InvariantCulture), r.Body, TextLeft, lineY);
                    if (k < name.Count) r.Text(name[k], r.Body, NameX, lineY);
                    if (k < comment.Count) r.Text(comment[k], r.Body, ColComment, lineY);
                    if (k < response.Count) r.Text(response[k], r.Body, ColResponse, lineY);
                }

                r.MoveTo(first - (lines - 1) * BodyStep);
            }

            r.Space(13.3);
            r.Text("Additional observations:", r.Body, TextLeft, r.Fit(r.Cursor));
        }

        private static void DrawQuestionsHeader(ProceedingsRenderer r)
        {
            var y = r.Fit(r.Cursor);
            r.Text("No.", r.Body, TextLeft, y);
            r.Text("Panel Member", r.Body, ColMember, y);
            r.Text("Question/ Comments/ Recommendations", r.Body, ColComment, y);
            r.Text("Proponents' Response/ Required Action", r.Body, ColResponse, y);
        }

        // ── VI. Evaluation and panel deliberation ──────────────────────────────

        private static void DrawEvaluation(ProceedingsRenderer r)
        {
            r.DrawHeading("VI. EVALUATION AND PANEL DELIBERATION", 13.6);

            Line(
                r,
                "The panel evaluated the project based on the applicable institutional evaluation rubric. The assessment considered the project's",
                r.Body,
                TextLeft,
                10.0);
            Line(
                r,
                "relevance, clarity of objectives, technical or research methodology, feasibility, quality of the presentation, and the proponents’",
                r.Body,
                TextLeft,
                10.0);
            Line(r, "responses to questions.", r.Body, TextLeft, 13.4);
            Line(
                r,
                "For System Validation and Final Defense, the panel may also consider system functionality, technical quality, testing and validation",
                r.Body,
                TextLeft,
                10.0);
            Line(
                r,
                "evidence, documentation, and the completeness of the implemented solution.",
                r.Body,
                TextLeft,
                18.7);

            var y = r.Fit(r.Cursor);
            r.Text("Evaluation Component", r.BodyBold, TextLeft, y);
            r.Text("Score / Result", r.BodyBold, 256.1, y);

            r.Space(13.2);
            y = r.Fit(r.Cursor);
            r.Text("Written Rubric / Evaluation Score", r.Body, TextLeft, y);
            r.Text(Blank(10), r.Body, ColMiddle, y);

            r.Space(16.0);
            y = r.Fit(r.Cursor);
            r.Text("Panel Comments", r.Body, TextLeft, y);
            r.Text("See Section V", r.Body, ColMiddle, y);

            r.Space(16.6);
            y = r.Fit(r.Cursor);
            r.Text("Required Revisions", r.Body, TextLeft, y);
            r.CheckBox(ColMiddle, y);
            r.Text("None", r.Body, 265.1, y);
            r.CheckBox(288.2, y);
            r.Text("Minor", r.Body, 299.3, y);
            r.CheckBox(323.3, y);
            r.Text("Major", r.Body, 334.4, y);

            r.Space(16.7);
            y = r.Fit(r.Cursor);
            r.Text("Re-defense Required", r.Body, TextLeft, y);
            r.CheckBox(ColMiddle, y);
            r.Text("Yes", r.Body, 265.0, y);
            r.CheckBox(281.5, y);
            r.Text("No", r.Body, 292.6, y);
        }

        // ── VII. Panel decision ────────────────────────────────────────────────

        private static void DrawDecision(ProceedingsRenderer r)
        {
            r.DrawHeading("VII. PANEL DECISION", 14.2);              // 733.0 → 718.8
            Line(
                r,
                "Following the presentation, questioning, evaluation, and deliberation, the panel reached the following decision:",
                r.Body,
                TextLeft,
                14.7);

            DecisionRow(r, 63.0, "APPROVED — The project is accepted at the current stage.", 15.3);
            DecisionRow(
                r,
                63.0,
                "APPROVED WITH REVISIONS — The project is accepted subject to completion of the specified revisions.",
                15.3);
            DecisionRow(
                r,
                63.4,
                "FOR RE-DEFENSE — The proponents must address the panel's concerns and undergo another defense, subject to institutional",
                9.9);
            Line(r, "policy.", r.Body, TextLeft, 15.4);
            DecisionRow(
                r,
                63.4,
                "NOT APPROVED — The project does not meet the requirements for approval at this stage.",
                13.3);

            r.Text("Basis for the Decision:", r.BodyBold, TextLeft, r.Fit(r.Cursor));
            r.Space(15.3);
            Line(
                r,
                $"Deadline for Compliance / Revisions: {Blank(26)}",
                r.Body,
                TextLeft,
                16.0);
            Line(
                r,
                $"Person Responsible for Verification: {Blank(27)}",
                r.Body,
                TextLeft,
                10.0);
        }

        /// <summary>Unchecked decision box with its regular-weight label.</summary>
        private static void DecisionRow(ProceedingsRenderer r, double labelX, string text, double gapAfter)
        {
            var y = r.Fit(r.Cursor);
            r.CheckBox(TextLeft, y);
            r.Text(text, r.Body, labelX, y);
            r.Space(gapAfter);
        }

        // ── VIII. Required revisions and compliance monitoring ─────────────────

        private static void DrawRequiredRevisions(ProceedingsRenderer r)
        {
            r.DrawHeading("VIII. REQUIRED REVISIONS AND COMPLIANCE MONITORING", 13.5);   // 587.2 → 573.7

            var y = r.Fit(r.Cursor);
            r.Text("No.", r.Body, TextLeft, y);
            r.Text("Required Revision / Action", r.Body, ColAction, y);
            r.Text("Responsible Person", r.Body, ColResponsible, y);
            r.Text("Verification / Status", r.Body, ColStatus, y);

            for (var i = 1; i <= 5; i++)
            {
                r.Space(i == 1 ? 13.4 : 13.3);
                y = r.Fit(r.Cursor);
                r.Text(i.ToString(CultureInfo.InvariantCulture), r.Body, TextLeft, y);
                r.Text(Blank(26), r.Body, ColAction, y);
                r.Text(Blank(26), r.Body, ColResponsible, y);
                r.Text(Blank(26), r.Body, ColStatus, y);
            }

            r.Space(17.3);
            y = r.Fit(r.Cursor);
            r.Text("Revision Verification:", r.BodyBold, TextLeft, y);
            r.Text("Remarks:", r.Body, ColResponsible, y);

            // 489.8 → 476.5 in the template (label line to first checkbox row).
            r.Space(13.3);
            VerifyRow(r, 63.0, "All required revisions have been completed.", 13.3);
            VerifyRow(r, 63.4, "Revisions are partially completed.", 13.3);
            VerifyRow(r, 63.0, "Additional revisions are required.", 13.4);

            DrawRemarksBox(r, y);
        }

        private static void VerifyRow(ProceedingsRenderer r, double labelX, string text, double gapAfter)
        {
            var baseline = r.Fit(r.Cursor);
            r.CheckBox(TextLeft, baseline);
            r.Text(text, r.Body, labelX, baseline);
            r.Space(gapAfter);
        }

        /// <summary>
        /// Remarks box: top, bottom and left edges only — the right side is closed by
        /// the frame rail, exactly as the template prints it.
        /// </summary>
        private static void DrawRemarksBox(ProceedingsRenderer r, double labelBaseline)
        {
            var top = labelBaseline - 2.2;
            var bottom = top - 39.9;

            r.DrawHorizontal(top, RemarksLeft, RuleRight);
            r.DrawHorizontal(bottom, RemarksLeft, RuleRight);
            r.DrawVertical(RemarksLeft + 0.4, top + 0.4, bottom - 0.4);
            r.MoveTo(bottom);
        }

        // ── IX. Closing of the proceedings ────────────────────────────────────

        private static void DrawClosing(ProceedingsRenderer r, ProceedingsDataDto data)
        {
            r.DrawHeading("IX. CLOSING OF THE PROCEEDINGS", 13.6);   // 423.5 → 409.9

            var time = data.EndingTime?.ToString("h:mm tt", CultureInfo.InvariantCulture) ?? Blank(10);
            Line(
                r,
                $"There being no further questions or matters for discussion, the proceedings concluded at {time}.",
                r.Body,
                TextLeft,
                18.0);
            Line(
                r,
                "The proponents were informed of the panel's decision and the corresponding recommendations and compliance requirements. The",
                r.Body,
                TextLeft,
                10.0);
            Line(
                r,
                "panel emphasized that all required revisions must be completed within the prescribed period and verified by the authorized faculty",
                r.Body,
                TextLeft,
                10.0);
            Line(r, "member or panel representative.", r.Body, TextLeft, 20.0);

            // Signature block — left the way the form prints it; the role picker only
            // records who generated the document (see Document Control).
            var y = r.Fit(r.Cursor);
            r.Text("Prepared by:", r.BodyBold, TextLeft, y);
            r.Text("Reviewed by:", r.BodyBold, ColMiddle, y);
            r.Text("Certified by:", r.BodyBold, ColSignature, y);

            r.Space(20.0);
            y = r.Fit(r.Cursor);
            r.Text(Blank(34), r.Body, TextLeft, y);
            r.Text(Blank(27), r.Body, ColMiddle, y);
            r.Text(Blank(32), r.Body, ColSignature, y);

            r.Space(13.5);
            y = r.Fit(r.Cursor);
            r.Text("Name and Signature", r.Small, TextLeft, y);
            r.Text("Name and Signature", r.Small, ColMiddle, y);
            r.Text("Name and Signature", r.Body, ColSignature, y);

            r.Space(13.3);
            y = r.Fit(r.Cursor);
            r.Text("Proceedings Secretary / Assigned Faculty Member", r.Small, TextLeft, y);
            r.Text("Capstone Adviser / Coordinator", r.Small, ColMiddle, y);
            r.Text("Panel Chairperson", r.Body, ColSignature, y);
        }

        // ── X. Acknowledgment of the proponents ───────────────────────────────

        private static void DrawAcknowledgment(ProceedingsRenderer r, ProceedingsDataDto data)
        {
            r.DrawHeading("X. ACKNOWLEDGMENT OF THE PROPONENTS", 14.2);   // 279.0 → 264.8
            Line(
                r,
                "We acknowledge that the panel's comments, recommendations, and required revisions have been communicated to us. We",
                r.Body,
                TextLeft,
                10.0);
            Line(
                r,
                "understand our responsibilities in complying with the requirements established during the proceedings.",
                r.Body,
                TextLeft,
                20.0);

            DrawAcknowledgmentHeader(r);

            var names = data.Members
                .OrderBy(member => member.SortKey, StringComparer.Ordinal)
                .Select(member => FillOrBlank(member.LastFirst, 34))
                .ToList();

            if (names.Count == 0) names.Add(Blank(34));

            double[] rowGaps = { 13.3, 15.9, 16.0, 15.3, 18.0 };

            for (var i = 0; i < names.Count; i++)
            {
                r.Space(i < rowGaps.Length ? rowGaps[i] : 15.9);

                // Keep the last row clear of the pinned Document Control block.
                if (r.Cursor < MinLastRowY)
                {
                    r.NewPage();
                    DrawAcknowledgmentHeader(r);
                    r.Space(13.3);
                }

                var y = r.Cursor;
                r.Text(names[i], r.Body, TextLeft, y);
                r.Text(Blank(13), r.Body, ColMiddle, y);
                r.Text(Blank(17), r.Body, ColSignature, y);
            }
        }

        private static void DrawAcknowledgmentHeader(ProceedingsRenderer r)
        {
            var y = r.Fit(r.Cursor);
            r.Text("Name of Proponent", r.BodyBold, 77.0, y);
            r.Text("Signature", r.BodyBold, ColMiddle, y);
            r.Text("Date", r.BodyBold, 427.1, y);
        }

        // ── Document control (pinned above the closing rule) ──────────────────

        private static void DrawDocumentControl(ProceedingsRenderer r, ProceedingsDataDto data)
        {
            r.Text("DOCUMENT CONTROL", r.BodyBold, TextLeft, DocControlY);

            const double row1 = 116.4;
            r.Text("Prepared by:", r.Body, TextLeft, row1);
            r.Text("Institute of Computer Studies", r.BodyBold, ValueX(r, "Prepared by:", TextLeft), row1);
            r.Text("Version:", r.Body, ColSignature, row1);
            r.Text("1.0", r.BodyBold, ValueX(r, "Version:", ColSignature), row1);

            const double row2 = 103.1;
            r.Text("Document Title:", r.Body, TextLeft, row2);
            r.Text(
                "BSIT Capstone Project Defense Proceedings",
                r.BodyBold,
                ValueX(r, "Document Title:", TextLeft),
                row2);
            r.Text("Effectivity Date:", r.Body, ColSignature, row2);
            r.Text(
                data.DefenseDate?.ToString("M/d/yyyy", CultureInfo.InvariantCulture) ?? Blank(10),
                r.BodyBold,
                ValueX(r, "Effectivity Date:", ColSignature),
                row2);

            // Row 3's right cell: blank, the way the department template prints it.
            const double row3 = 89.7;
            r.Text($"Approved by: {Blank(22)}", r.Body, TextLeft, row3);
        }

        /// <summary>Where a bold value starts: one space after its regular label.</summary>
        private static double ValueX(ProceedingsRenderer r, string label, double labelX)
            => labelX + r.Measure(label, r.Body) + r.Measure(" ", r.Body);

        // ── Shared line primitives ────────────────────────────────────────────

        /// <summary>Draws <paramref name="text"/> at the cursor and leaves the given gap below it.</summary>
        private static void Line(ProceedingsRenderer r, string text, XFont font, double x, double gapAfter)
        {
            var y = r.Fit(r.Cursor);
            r.Text(text, font, x, y);
            r.Space(gapAfter);
        }

        /// <summary>Same, but shrinks the font when the line would overrun <paramref name="maxWidth"/>.</summary>
        private static void LineFitted(
            ProceedingsRenderer r,
            string text,
            XFont font,
            double x,
            double gapAfter,
            double maxWidth)
        {
            var y = r.Fit(r.Cursor);
            r.TextFitted(text, font, x, y, maxWidth, XFontStyle.Regular);
            r.Space(gapAfter);
        }
    }
}
