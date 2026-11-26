namespace ClubConnect.Application.Clubs;

/// <summary>
/// Command to register or cancel a member's RSVP for a scheduled club event (INC-26).
/// </summary>
public sealed record SetEventRsvpCommand(
    Guid ClubId,
    Guid EventId,
    Guid MemberId,
    bool IsAttending);
