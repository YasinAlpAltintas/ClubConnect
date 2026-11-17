using ClubConnect.Domain.Entities;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Status outcome for a create club event command (INC-24).
/// </summary>
public enum CreateClubEventStatus
{
    Success,
    InvalidInput,
    NotFound,
    Forbidden,
    Failure
}

/// <summary>
/// Domain outcome returned by <see cref="CreateClubEventUseCase"/>.
/// </summary>
public sealed record CreateClubEventOutcome
{
    public CreateClubEventStatus Status { get; init; }

    public ClubEvent? Event { get; init; }

    public string? Violation { get; init; }

    public static CreateClubEventOutcome Success(ClubEvent createdEvent) =>
        new()
        {
            Status = CreateClubEventStatus.Success,
            Event = createdEvent
        };

    public static CreateClubEventOutcome InvalidInput(string violation) =>
        new() { Status = CreateClubEventStatus.InvalidInput, Violation = violation };

    public static CreateClubEventOutcome NotFound(string violation = "Club not found.") =>
        new() { Status = CreateClubEventStatus.NotFound, Violation = violation };

    public static CreateClubEventOutcome Forbidden(string violation = "Only Club Admins can schedule club events.") =>
        new() { Status = CreateClubEventStatus.Forbidden, Violation = violation };

    public static CreateClubEventOutcome Failure(string error) =>
        new() { Status = CreateClubEventStatus.Failure, Violation = error };
}
