using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;
using server.Services.Interfaces;

namespace server.Services.Theses
{
    public class ProceedingsService : IProceedingsService
    {
        public async Task<byte[]> GenerateProceedingsAsync(Guid thesisId)
        {
            using var document = new PdfDocument();

            var page = document.AddPage();

            using var graphics = XGraphics.FromPdfPage(page);

            var font = new XFont("Arial", 20, XFontStyle.Bold);

            graphics.DrawString(
                "Thesis Proceedings",
                font,
                XBrushes.Black,
                new XRect(0, 0, page.Width, page.Height),
                XStringFormats.Center
            );

            using var stream = new MemoryStream();

            document.Save(stream, false);

            return await Task.FromResult(stream.ToArray());
        }
    }
}