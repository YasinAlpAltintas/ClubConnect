namespace ClubConnect.Application.Clubs;

/// <summary>
/// Status outcome for a member removal operation.
/// </summary>
public enum RemoveClubMemberStatus
{
    Success,
    InvalidInput,
    NotFound,
    Forbidden
}

/// <summary>
/// Outcome result of executing <see cref="RemoveClubMemberUseCase"/>.
/// </summary>
public sealed record RemoveClubMemberOutcome(
    RemoveClubMemberStatus Status,
    string? Violation = null)
{
    public static RemoveClubMemberOutcome Success() =>
        new(RemoveClubMemberStatus.Success);

    public static RemoveClubMemberOutcome InvalidInput(string violation) =>
        new(RemoveClubMemberStatus.InvalidInput, Violation: violation);

    public static RemoveClubMemberOutcome NotFound(string violation) =>
        new(RemoveClubMemberStatus.NotFound, Violation: violation);

    public static RemoveClubMemberOutcome Forbidden(string violation) =>
        new(RemoveClubMemberStatus.Forbidden, Violation: violation);
}
