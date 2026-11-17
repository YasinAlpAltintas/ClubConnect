namespace ClubConnect.Domain.Entities;

/// <summary>
/// Represents a club member's RSVP attendance record for a scheduled club event (INC-26).
/// </summary>
public class ClubEventAttendee
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>ID of the scheduled event.</summary>
    public Guid EventId { get; set; }

    /// <summary>Scheduled event navigation entity.</summary>
    public ClubEvent? Event { get; set; }

    /// <summary>ID of the club member who RSVP'd.</summary>
    public Guid MemberId { get; set; }

    /// <summary>Member navigation entity.</summary>
    public Member? Member { get; set; }

    /// <summary>Timestamp in UTC when the member recorded their RSVP.</summary>
    public DateTimeOffset RsvpAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
