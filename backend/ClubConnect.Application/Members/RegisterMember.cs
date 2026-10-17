namespace ClubConnect.Application.Members;

/// <summary>Input to create a club member account.</summary>
/// <remarks>
/// <see cref="Email"/> is trimmed, lower-cased and de-duplicated by use
/// (e.g. "User" -> "user@club.be"). <see cref="Password"/> must satisfy the
/// account security policy (min 8 chars, at least one letter, at least one digit).
/// </remarks>
public record RegisterMemberCommand
{
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;

    public RegisterMemberCommand WithNormalizedEmail(string normalizedEmail) =>
        this with { Email = normalizedEmail };
}

/// <summary>Result of a successful registration.</summary>
public class RegisterMemberResult
{
    public Guid MemberId { get; init; }
    public string NormalizedEmail { get; init; } = string.Empty;
}
