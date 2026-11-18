namespace server.Services.Interfaces
{
    public interface IProceedingsService
    {
        /// <summary>
        /// Null when the thesis does not exist. <paramref name="generatedByRole"/>
        /// records who asked for the PDF in its Document Control block.
        /// </summary>
        Task<byte[]?> GenerateProceedingsAsync(
            Guid thesisId,
            string? generatedByRole,
            CancellationToken cancellationToken);

        Task<bool> IsStudentThesisMemberAsync(
            Guid thesisId,
            string studentId,
            CancellationToken cancellationToken);
    }
}
