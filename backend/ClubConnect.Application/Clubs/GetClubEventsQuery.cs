namespace ClubConnect.Application.Clubs;

/// <summary>
/// Query parameters for retrieving scheduled events of a club workspace (INC-23).
/// Allows optional date filtering by year &amp; month or range.
/// </summary>
public sealed record GetClubEventsQuery
{
    public Guid ClubId { get; init; }
    public Guid RequestingMemberId { get; init; }
    public int? Year { get; init; }
    public int? Month { get; init; }
    public DateTimeOffset? FromUtc { get; init; }
    public DateTimeOffset? ToUtc { get; init; }
}
