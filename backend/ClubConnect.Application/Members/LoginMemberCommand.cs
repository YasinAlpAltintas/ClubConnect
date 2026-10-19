namespace ClubConnect.Application.Members;

/// <summary>
/// Input command for logging in an existing club member.
/// </summary>
public sealed record LoginMemberCommand
{
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}
