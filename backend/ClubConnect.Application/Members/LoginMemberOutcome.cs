namespace ClubConnect.Application.Members;

public enum LoginStatus
{
    Success,
    InvalidInput,
    InvalidCredentials
}

/// <summary>
/// Outcome of attempting to log in a member.
/// </summary>
public sealed record LoginMemberOutcome(
    LoginStatus Status,
    Guid? MemberId = null,
    string? Email = null,
    string? DisplayName = null,
    string? Violation = null);
