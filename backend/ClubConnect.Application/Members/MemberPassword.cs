using System.Text.RegularExpressions;

namespace ClubConnect.Application.Members;

/// <summary>
/// Account security policy: a password must be at least 8 characters long and
/// contain at least one letter (a-z) and one digit (0-9). Any of a-z, A-Z,
/// or 0-9 satisfies the "letter" requirement so the rule stays simple yet
/// blocks all-digit or all-symbol passwords.
/// </summary>
/// <remarks>
/// This is the single source of truth for password strength. The frontend
/// mirrors this with a Zod schema of the same shape so users see the same
/// errors before and after submission.
/// </remarks>
public static class MemberPassword
{
    public const int MinimumLength = 8;

    private static readonly Regex HasLetter = new(@"[A-Za-z]", RegexOptions.Compiled);
    private static readonly Regex HasDigit = new(@"[0-9]", RegexOptions.Compiled);

    /// <summary>
    /// Returns null when <paramref name="password"/> satisfies the policy,
    /// otherwise a human-readable violation message.
    /// </summary>
    public static string? Validate(string? password)
    {
        if (string.IsNullOrEmpty(password))
            return "Password is required.";

        if (password.Length < MinimumLength)
            return $"Password must be at least {MinimumLength} characters long.";

        if (!HasLetter.IsMatch(password))
            return "Password must contain at least one letter.";

        if (!HasDigit.IsMatch(password))
            return "Password must contain at least one digit.";

        return null;
    }
}
