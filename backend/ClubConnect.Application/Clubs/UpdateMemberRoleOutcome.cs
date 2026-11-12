using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Status outcome for a member role modification operation.
/// </summary>
public enum UpdateMemberRoleStatus
{
    Success,
    InvalidInput,
    NotFound,
    Forbidden
}

/// <summary>
/// Outcome result of executing <see cref="UpdateMemberRoleUseCase"/>.
/// </summary>
public sealed record UpdateMemberRoleOutcome(
    UpdateMemberRoleStatus Status,
    ClubMemberDetail? Member = null,
    string? Violation = null)
{
    public static UpdateMemberRoleOutcome Success(ClubMemberDetail member) =>
        new(UpdateMemberRoleStatus.Success, Member: member);

    public static UpdateMemberRoleOutcome InvalidInput(string violation) =>
        new(UpdateMemberRoleStatus.InvalidInput, Violation: violation);

    public static UpdateMemberRoleOutcome NotFound(string violation) =>
        new(UpdateMemberRoleStatus.NotFound, Violation: violation);

    public static UpdateMemberRoleOutcome Forbidden(string violation) =>
        new(UpdateMemberRoleStatus.Forbidden, Violation: violation);
}
