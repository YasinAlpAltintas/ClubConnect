using ClubConnect.Domain.Entities;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Status outcomes for an update event operation (INC-25).
/// </summary>
public enum UpdateClubEventStatus
{
    Success,
    InvalidInput,
    NotFound,
    Forbidden
}

/// <summary>
/// Result of executing an update event command (INC-25).
/// </summary>
public sealed record UpdateClubEventOutcome(
    UpdateClubEventStatus Status,
    ClubEvent? Event = null,
    string? ErrorMessage = null)
{
    public static UpdateClubEventOutcome Success(ClubEvent clubEvent) =>
        new(UpdateClubEventStatus.Success, Event: clubEvent);

    public static UpdateClubEventOutcome InvalidInput(string message) =>
        new(UpdateClubEventStatus.InvalidInput, ErrorMessage: message);

    public static UpdateClubEventOutcome NotFound(string message) =>
        new(UpdateClubEventStatus.NotFound, ErrorMessage: message);

    public static UpdateClubEventOutcome Forbidden(string message) =>
        new(UpdateClubEventStatus.Forbidden, ErrorMessage: message);
}
