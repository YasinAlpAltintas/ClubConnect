using ClubConnect.Domain.Entities;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Status outcome for a get club tasks query.
/// </summary>
public enum GetClubTasksStatus
{
    Success,
    InvalidInput,
    NotFound,
    Forbidden,
    Failure
}

/// <summary>
/// Domain outcome returned by <see cref="GetClubTasksUseCase"/>.
/// </summary>
public sealed record GetClubTasksOutcome
{
    public GetClubTasksStatus Status { get; init; }

    public IReadOnlyList<ClubTask> Tasks { get; init; } = Array.Empty<ClubTask>();

    public string? Violation { get; init; }

    public static GetClubTasksOutcome Success(IReadOnlyList<ClubTask> tasks) =>
        new() { Status = GetClubTasksStatus.Success, Tasks = tasks };

    public static GetClubTasksOutcome InvalidInput(string violation) =>
        new() { Status = GetClubTasksStatus.InvalidInput, Violation = violation };

    public static GetClubTasksOutcome NotFound(string violation = "Club not found.") =>
        new() { Status = GetClubTasksStatus.NotFound, Violation = violation };

    public static GetClubTasksOutcome Forbidden(string violation = "You do not have access to this club workspace.") =>
        new() { Status = GetClubTasksStatus.Forbidden, Violation = violation };

    public static GetClubTasksOutcome Failure(string error) =>
        new() { Status = GetClubTasksStatus.Failure, Violation = error };
}
