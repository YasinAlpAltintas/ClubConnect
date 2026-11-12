namespace ClubConnect.Application.Clubs;

/// <summary>
/// Command for modifying the role of a member in a club workspace (e.g. promoting to "Club Admin").
/// </summary>
public sealed class UpdateMemberRoleCommand
{
    public Guid ClubId { get; init; }
    public Guid RequestingMemberId { get; init; }
    public Guid TargetMemberId { get; init; }
    public string Role { get; init; } = string.Empty;
}
