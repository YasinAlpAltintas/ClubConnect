namespace ClubConnect.Domain.Entities;

/// <summary>
/// Represents a 6-digit invitation code associated with a <see cref="Club"/>.
/// Used by prospective members to join the club workspace as a "Club Member".
/// </summary>
public class ClubInvite
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>Foreign key to the associated <see cref="Club"/>.</summary>
    public Guid ClubId { get; set; }

    /// <summary>Navigation property to the associated <see cref="Club"/>.</summary>
    public Club? Club { get; set; }

    /// <summary>
    /// Exact 6-digit numeric invite code (e.g. "048291").
    /// Stored as a string to preserve leading zeros.
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>UTC timestamp when the invite code was generated.</summary>
    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Optional UTC timestamp when the invite code expires.</summary>
    public DateTimeOffset? ExpiresAtUtc { get; set; }

    /// <summary>Whether this invite code is currently active and can be used to join.</summary>
    public bool IsActive { get; set; } = true;
}
