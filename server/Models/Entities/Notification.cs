using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    // One row per recipient per event (fan-out at write time) so per-user
    // unread counts and read-state stay a simple indexed query.
    public class Notification
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>Firebase UID of the recipient.</summary>
        [Required]
        public string UserId { get; set; } = string.Empty;

        /// <summary>
        /// Event kind — one of the NotificationKinds constants:
        /// GroupAdded, GroupRemoved, DefenseScheduled, DefenseRescheduled,
        /// DefenseCancelled, PanelistAssigned, Announcement.
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = string.Empty;

        [Required]
        [MaxLength(256)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Body { get; set; } = string.Empty;

        /// <summary>
        /// What the row deep-links to (research_group | schedule | announcement).
        /// Clients map this + TargetId to their own router paths.
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string TargetType { get; set; } = string.Empty;

        /// <summary>Guid of the target as string (group/schedule/announcement id).</summary>
        [MaxLength(64)]
        public string? TargetId { get; set; }

        public bool IsRead { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>Well-known Type / TargetType values shared by every trigger.</summary>
    public static class NotificationKinds
    {
        public const string GroupAdded = "GroupAdded";
        public const string GroupRemoved = "GroupRemoved";
        public const string DefenseScheduled = "DefenseScheduled";
        public const string DefenseRescheduled = "DefenseRescheduled";
        public const string DefenseCancelled = "DefenseCancelled";
        public const string PanelistAssigned = "PanelistAssigned";
        public const string Announcement = "Announcement";

        public const string TargetResearchGroup = "research_group";
        public const string TargetSchedule = "schedule";
        public const string TargetAnnouncement = "announcement";
    }
}
