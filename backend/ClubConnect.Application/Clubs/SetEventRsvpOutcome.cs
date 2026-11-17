using ClubConnect.Domain.Entities;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Status outcome for setting an event RSVP.
/// </summary>
public enum SetEventRsvpStatus
{
    Success,
    InvalidInput,
    NotFound,
    Forbidden
}

/// <summary>
/// Result of attempting to set an event RSVP.
/// </summary>
public sealed record SetEventRsvpOutcome(
    SetEventRsvpStatus Status,
    ClubEvent? Event = null,
    string? ErrorMessage = null)
{
    public static SetEventRsvpOutcome Success(ClubEvent clubEvent) =>
        new(SetEventRsvpStatus.Success, Event: clubEvent);

    public static SetEventRsvpOutcome InvalidInput(string message) =>
        new(SetEventRsvpStatus.InvalidInput, ErrorMessage: message);

    public static SetEventRsvpOutcome NotFound(string message) =>
        new(SetEventRsvpStatus.NotFound, ErrorMessage: message);

    public static SetEventRsvpOutcome Forbidden(string message) =>
        new(SetEventRsvpStatus.Forbidden, ErrorMessage: message);
}
