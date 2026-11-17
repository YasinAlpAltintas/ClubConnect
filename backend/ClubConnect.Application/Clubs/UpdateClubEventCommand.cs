namespace ClubConnect.Application.Clubs;

/// <summary>
/// Command to update or complete scheduled event details (INC-25).
/// </summary>
public sealed record UpdateClubEventCommand(
    Guid ClubId,
    Guid EventId,
    Guid AdminMemberId,
    string Title,
    string? Description,
    string? Location,
    DateTimeOffset StartTimeUtc,
    DateTimeOffset EndTimeUtc);
