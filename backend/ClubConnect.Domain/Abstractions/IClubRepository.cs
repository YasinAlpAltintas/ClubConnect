using ClubConnect.Domain.Entities;

namespace ClubConnect.Domain.Abstractions;

/// <summary>
/// Summary representation of a club and the user's role in it.
/// </summary>
public sealed record ClubMembershipSummary(
    Guid Id,
    string Name,
    string? Description,
    string Role);

/// <summary>
/// Persistence operations for <see cref="Club"/> and its associated memberships.
/// </summary>
public interface IClubRepository
{
    /// <summary>
    /// Atomically creates a new club and assigns the specified member as the initial "Club Admin".
    /// Must execute inside a single transaction and roll back if either operation fails.
    /// </summary>
    Task<Club> CreateClubWithAdminAsync(
        string name,
        string? description,
        Guid adminMemberId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Retrieves all clubs that the specified member belongs to, along with their role in each club.
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
}
