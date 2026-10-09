namespace server.Models.Exceptions
{
    public sealed class ScheduleAlreadyExistsException : InvalidOperationException
    {
        public ScheduleAlreadyExistsException(Guid groupId)
            : base($"This research group already has a scheduled defense.")
        {
            GroupId = groupId;
        }

        public Guid GroupId { get; }
    }
}
