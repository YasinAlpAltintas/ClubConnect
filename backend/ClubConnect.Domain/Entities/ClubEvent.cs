namespace ClubConnect.Domain.Entities;

/// <summary>
/// A scheduled event or activity organized by a club workspace (INC-23).
/// </summary>
public class ClubEvent
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>ID of the owning club workspace.</summary>
    public Guid ClubId { get; set; }

    /// <summary>Owning club entity.</summary>
    public Club? Club { get; set; }

    /// <summary>Title or name of the event (e.g. "Weekly Board Game Night").</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Detailed description or agenda of the activity.</summary>
    public string? Description { get; set; }

    /// <summary>Physical venue, room number, or virtual meeting URL.</summary>
    public string? Location { get; set; }

    /// <summary>Scheduled start time in UTC.</summary>
    public DateTimeOffset StartTimeUtc { get; set; }

    /// <summary>Scheduled end time in UTC.</summary>
    public DateTimeOffset EndTimeUtc { get; set; }

    /// <summary>ID of the club member who created the event.</summary>
    public Guid CreatedByMemberId { get; set; }

    /// <summary>Member who created the event.</summary>
    public Member? CreatedByMember { get; set; }

    /// <summary>Creation timestamp in UTC.</summary>
    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
