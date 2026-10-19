namespace server.Models.DTOs.Notification
{
    public class NotificationResponseDto
    {
        public Guid Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string TargetType { get; set; } = string.Empty;
        public string? TargetId { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class NotificationPageResponseDto
    {
        public List<NotificationResponseDto> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int UnreadCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }
}
