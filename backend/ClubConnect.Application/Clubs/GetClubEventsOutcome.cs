using ClubConnect.Domain.Entities;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Status outcome for a get club events query.
/// </summary>
public enum GetClubEventsStatus
{
    Success,
    InvalidInput,
    NotFound,
    Forbidden,
    Failure
}

/// <summary>
/// Domain outcome returned by <see cref="GetClubEventsUseCase"/>.
/// </summary>
public sealed record GetClubEventsOutcome
{
    public GetClubEventsStatus Status { get; init; }

    public IReadOnlyList<ClubEvent> Events { get; init; } = Array.Empty<ClubEvent>();

    public string? Violation { get; init; }

    public static GetClubEventsOutcome Success(IReadOnlyList<ClubEvent> events) =>
        new()
        {
            Status = GetClubEventsStatus.Success,
            Events = events
        };

    public static GetClubEventsOutcome InvalidInput(string violation) =>
        new() { Status = GetClubEventsStatus.InvalidInput, Violation = violation };

    public static GetClubEventsOutcome NotFound(string violation = "Club not found.") =>
        new() { Status = GetClubEventsStatus.NotFound, Violation = violation };

    public static GetClubEventsOutcome Forbidden(string violation = "You do not have access to this club workspace.") =>
        new() { Status = GetClubEventsStatus.Forbidden, Violation = violation };

    public static GetClubEventsOutcome Failure(string error) =>
        new() { Status = GetClubEventsStatus.Failure, Violation = error };
}
