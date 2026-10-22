namespace ClubConnect.Application.Clubs;

/// <summary>
/// Command to create a new club workspace.
/// </summary>
public sealed record CreateClubCommand
{
    /// <summary>Name of the club.</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>Optional club description.</summary>
    public string? Description { get; init; }

    /// <summary>Member ID of the creator extracted from JWT claims.</summary>
    public Guid AdminMemberId { get; init; }
}
