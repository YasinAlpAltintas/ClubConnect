namespace ClubConnect.Application.Clubs;

/// <summary>
/// Command payload for scheduling a new club event (INC-24).
/// </summary>
public sealed record CreateClubEventCommand
{
    public Guid ClubId { get; init; }
    public Guid AdminMemberId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? Location { get; init; }
    public DateTimeOffset StartTimeUtc { get; init; }
    public DateTimeOffset EndTimeUtc { get; init; }
}
