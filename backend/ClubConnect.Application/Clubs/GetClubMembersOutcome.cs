using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Status outcome for a get club members query.
/// </summary>
public enum GetClubMembersStatus
{
    Success,
    InvalidInput,
    NotFound,
    Forbidden,
    Failure
}

/// <summary>
/// Domain outcome returned by <see cref="GetClubMembersUseCase"/>.
/// </summary>
public sealed record GetClubMembersOutcome
{
    public GetClubMembersStatus Status { get; init; }

    public IReadOnlyList<ClubMemberDetail> Members { get; init; } = Array.Empty<ClubMemberDetail>();

    public string? Violation { get; init; }

    public static GetClubMembersOutcome Success(IReadOnlyList<ClubMemberDetail> members) =>
        new()
        {
            Status = GetClubMembersStatus.Success,
            Members = members
        };

    public static GetClubMembersOutcome InvalidInput(string violation) =>
        new() { Status = GetClubMembersStatus.InvalidInput, Violation = violation };

    public static GetClubMembersOutcome NotFound(string violation = "Club not found.") =>
        new() { Status = GetClubMembersStatus.NotFound, Violation = violation };

    public static GetClubMembersOutcome Forbidden(string violation = "Only club administrators can access the member overview.") =>
        new() { Status = GetClubMembersStatus.Forbidden, Violation = violation };

    public static GetClubMembersOutcome Failure(string error) =>
        new() { Status = GetClubMembersStatus.Failure, Violation = error };
}
