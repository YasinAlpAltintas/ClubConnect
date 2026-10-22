namespace ClubConnect.Application.Clubs;

/// <summary>
/// Command to join an existing club workspace using a 6-digit invite code.
/// </summary>
public sealed record JoinClubCommand
{
    /// <summary>Unique identifier of the authenticated member joining the club.</summary>
    public Guid MemberId { get; init; }

    /// <summary>Exact 6-digit invite code provided by the user.</summary>
    public string Code { get; init; } = string.Empty;
}
