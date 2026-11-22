using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities;

/// <summary>
/// Single-use marker for a student-ID verification receipt. The receipt and
/// its personal claims are deliberately not persisted.
/// </summary>
public sealed class ConsumedIdVerificationReceipt
{
    [Key]
    [MaxLength(36)]
    public string Jti { get; set; } = null!;

    [Required]
    [MaxLength(128)]
    public string FirebaseUid { get; set; } = null!;

    [Required]
    [MaxLength(64)]
    public string RegistrationFingerprint { get; set; } = null!;

    [Required]
    [MaxLength(64)]
    public string TemplateId { get; set; } = null!;

    public DateTime ConsumedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
}
