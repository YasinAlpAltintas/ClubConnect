namespace ClubConnect.Domain.Entities;

/// <summary>
/// Represents the association between a <see cref="Member"/> and a <see cref="Club"/>.
/// Stores the member's authorization role (e.g., "Club Admin", "Member") within that club workspace.
/// </summary>
public class Membership
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>Foreign key to the associated <see cref="Club"/>.</summary>
    public Guid ClubId { get; set; }

    /// <summary>Navigation property to the associated <see cref="Club"/>.</summary>
    public Club? Club { get; set; }

    /// <summary>Foreign key to the associated <see cref="Member"/>.</summary>
    public Guid MemberId { get; set; }

    /// <summary>Navigation property to the associated <see cref="Member"/>.</summary>
    public Member? Member { get; set; }

    /// <summary>The role of the member in this club workspace (e.g. "Club Admin").</summary>
    public string Role { get; set; } = "Club Admin";

    /// <summary>Timestamp when the membership was created in UTC.</summary>
    public DateTimeOffset JoinedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
