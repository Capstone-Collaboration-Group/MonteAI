namespace server.Services.Theses;

public sealed class AnnotationReadException : Exception
{
    public AnnotationReadException(Guid thesisId, Exception innerException)
        : base($"Failed to retrieve annotations for thesis {thesisId}.", innerException)
    {
        ThesisId = thesisId;
    }

    public Guid ThesisId { get; }
}
