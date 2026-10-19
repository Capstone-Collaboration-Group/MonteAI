// server/Services/Email/EmailTemplates.cs
//
// Static HTML/text builders for the emails this app sends. Every template
// returns BOTH an HTML and a plain-text body (EmailJob carries both) so
// mail clients that strip HTML still show the message.
//
// Reusable by design: add a new static method per email event and call
// IEmailService.Queue(...) — no template engine, matching the codebase's
// string-built approach (see ProceedingsService).

namespace server.Services.Email
{
    public sealed record EmailContent(string Subject, string Html, string Text);

    public static class EmailTemplates
    {
        public static EmailContent PasswordChanged(string recipientName, DateTime changedAtUtc)
            => new(
                "Your MonteAI password was changed",
                Layout(
                    "Password changed",
                    $"<p>Hi {Escape(recipientName)},</p>" +
                    "<p>Your <strong>MonteAI / MonteSkolar</strong> password was just changed.</p>" +
                    $"<p class=\"meta\">{FormatTime(changedAtUtc)}</p>" +
                    "<p>If this was <strong>not</strong> you, reset your password immediately and contact your administrator.</p>"),
                $"Hi {recipientName},\n\nYour MonteAI / MonteSkolar password was just changed.\n{FormatTime(changedAtUtc)}\n\nIf this was not you, reset your password immediately and contact your administrator.");

        public static EmailContent MfaEnabled(string recipientName, DateTime enabledAtUtc)
            => new(
                "Multi-factor authentication enabled",
                Layout(
                    "Multi-factor authentication is ON",
                    $"<p>Hi {Escape(recipientName)},</p>" +
                    "<p>Two-factor authentication (TOTP) has been <strong>enabled</strong> on your MonteAI account.</p>" +
                    $"<p class=\"meta\">{FormatTime(enabledAtUtc)}</p>" +
                    "<p>You will now be asked for a code from your authenticator app when signing in. If this was not you, disable it right away and contact your administrator.</p>"),
                $"Hi {recipientName},\n\nTwo-factor authentication (TOTP) has been enabled on your MonteAI account.\n{FormatTime(enabledAtUtc)}\n\nIf this was not you, disable it right away and contact your administrator.");

        public static EmailContent MfaDisabled(string recipientName, DateTime disabledAtUtc)
            => new(
                "Multi-factor authentication disabled",
                Layout(
                    "Multi-factor authentication is OFF",
                    $"<p>Hi {Escape(recipientName)},</p>" +
                    "<p>Two-factor authentication (TOTP) has been <strong>disabled</strong> on your MonteAI account.</p>" +
                    $"<p class=\"meta\">{FormatTime(disabledAtUtc)}</p>" +
                    "<p>Your account is now protected by your password only. If this was not you, re-enable MFA and contact your administrator.</p>"),
                $"Hi {recipientName},\n\nTwo-factor authentication (TOTP) has been disabled on your MonteAI account.\n{FormatTime(disabledAtUtc)}\n\nIf this was not you, re-enable MFA and contact your administrator.");

        /// <summary>Escape hatch for future emails — plain reusable shell.</summary>
        public static EmailContent Simple(string subject, string heading, string htmlParagraph, string textBody)
            => new(subject, Layout(heading, $"<p>{htmlParagraph}</p>"), textBody);

        private static string Layout(string heading, string bodyHtml)
            => """
               <!DOCTYPE html>
               <html>
               <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
                 <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
                   <div style="font-size:20px;font-weight:700;color:#1d4ed8;margin-bottom:4px;">MonteAI</div>
                   <div style="font-size:13px;color:#6b7280;margin-bottom:20px;">Colegio de Montalban &middot; MonteSkolar</div>
                   <h1 style="font-size:18px;color:#111827;margin:0 0 16px;">{heading}</h1>
                   <div style="font-size:15px;line-height:1.6;color:#374151;">{bodyHtml}</div>
                   <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
                   <div style="font-size:12px;color:#9ca3af;">This is an automated security notice from MonteAI. Please do not reply to this email.</div>
                 </div>
               </body>
               </html>
               """;

        private static string FormatTime(DateTime utc)
            => $"{utc:MMMM d, yyyy 'at' h:mm tt} UTC";

        private static string Escape(string? value)
            => System.Net.WebUtility.HtmlEncode(value ?? string.Empty);
    }
}
