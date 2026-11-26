namespace ClubConnect.Application.Clubs;

/// <summary>
/// Query for retrieving the Kanban tasks of a club workspace (INC-27).
/// </summary>
public sealed record GetClubTasksQuery
{
    public Guid ClubId { get; init; }
    public Guid RequestingMemberId { get; init; }
}
