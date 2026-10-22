using ClubConnect.Domain.Entities;

namespace ClubConnect.Domain.Abstractions;

/// <summary>
/// Status outcome for a join club operation at the repository/persistence layer.
/// </summary>
public enum JoinClubRepositoryStatus
{
    Success,
    NotFound,
    Expired,
    AlreadyMember,
    Failure
}

/// <summary>
/// Result of attempting to join a club using an invite code at the persistence level.
/// </summary>
public sealed record JoinClubResult(
    JoinClubRepositoryStatus Status,
    Guid? ClubId = null,
    string? Name = null,
    string? Description = null,
    string? Role = null,
    DateTimeOffset? JoinedAtUtc = null,
    string? ErrorMessage = null);

/// <summary>
/// Summary representation of a club and the user's role in it.
/// If the member is a "Club Admin", <see cref="InviteCode"/> contains the club's active invite code.
/// </summary>
public sealed record ClubMembershipSummary(
    Guid Id,
    string Name,
    string? Description,
    string Role,
    string? InviteCode = null);

/// <summary>
/// Persistence operations for <see cref="Club"/> and its associated memberships and invite codes.
/// </summary>
public interface IClubRepository
{
    /// <summary>
    /// Atomically creates a new club, assigns the specified member as the initial "Club Admin",
    /// and generates a unique active 6-digit invite code.
    /// Must execute inside a single transaction and roll back if any step fails.
    /// </summary>
    Task<Club> CreateClubWithAdminAsync(
        string name,
        string? description,
        Guid adminMemberId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Retrieves all clubs that the specified member belongs to, along with their role in each club.
    /// Includes the active invite code if the member is a "Club Admin".
    /// </summary>
    Task<IReadOnlyList<ClubMembershipSummary>> GetClubsForMemberAsync(
        Guid memberId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Finds a club by its unique identifier.
    /// </summary>
    Task<Club?> GetByIdAsync(
        Guid clubId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Finds an active invite code by its 6-digit string code.
    /// </summary>
    Task<ClubInvite?> GetActiveInviteCodeAsync(
        string code,
        CancellationToken cancellationToken);

    /// <summary>
    /// Finds the currently active invite code for the given club ID.
    /// </summary>
    Task<ClubInvite?> GetInviteCodeForClubAsync(
        Guid clubId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Atomically joins a club using an invite code, assigning the user the "Club Member" role.
    /// Returns <see cref="JoinClubRepositoryStatus.AlreadyMember"/> if the member is already part of the club.
    /// </summary>
    Task<JoinClubResult> JoinClubByInviteCodeAsync(
        string code,
        Guid memberId,
        CancellationToken cancellationToken);
}
