namespace ClubConnect.Application.Clubs;

/// <summary>
/// Command for removing a member from a club workspace, revoking their membership and data access.
/// </summary>
public sealed class RemoveClubMemberCommand
{
    public Guid ClubId { get; init; }
    public Guid RequestingMemberId { get; init; }
    public Guid TargetMemberId { get; init; }
}
