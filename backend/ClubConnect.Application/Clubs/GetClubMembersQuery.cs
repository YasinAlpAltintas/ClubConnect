namespace ClubConnect.Application.Clubs;

/// <summary>
/// Query parameters for retrieving all members of a club.
/// </summary>
public sealed record GetClubMembersQuery
{
    public Guid ClubId { get; init; }
    public Guid RequestingMemberId { get; init; }
}
