using System.Text.RegularExpressions;

namespace ClubConnect.Application.Members;

/// <summary>
/// Canonicalizes and validates account e-mail addresses.
/// <para>
/// Canonical form: trimmed, lower-cased, exactly one "@" with a non-empty
/// local part and a domain that ends in a textual (letter) tld of at least
/// two chars. No part may lead/trail a dot or contain consecutive dots, and
/// the local part must not be a single dot.
/// </para>
/// </summary>
public static class MemberEmail
{
    private static readonly Regex ConsecutiveDots = new(@"\.{2,}", RegexOptions.Compiled);
    private static readonly Regex EdgeDot = new(@"^\.|\.$", RegexOptions.Compiled);

    /// <summary>
    /// Normalizes <paramref name="email"/> to its canonical form (trimmed,
    /// lower-cased). Returns null when the value is not a well-formed single
    /// e-mail address. This is the single source of truth so the frontend and
    /// backend agree on what a valid account e-mail is.
    /// </summary>
    public static string? Canonicalize(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return null;

        var value = email.Trim().ToLowerInvariant();
        if (value.Contains(' '))
            return null;

        var atIndex = value.LastIndexOf('@');
        if (atIndex <= 0 || atIndex != value.IndexOf('@'))
            return null;

        var local = value[..atIndex];
        var domain = value[(atIndex + 1)..];

        // --- local part ---
        if (string.IsNullOrEmpty(local) ||
            local.Length > 64 ||
            ConsecutiveDots.IsMatch(local) ||
            EdgeDot.IsMatch(local))
            return null;

        // --- domain ---
        if (string.IsNullOrEmpty(domain))
            return null;

        // allow an IP-literal or a simple host with a textual tld >= 2 chars
        var labels = domain.Split('.');
        if (labels.Length < 2)
            return null;

        // the top-level label must be at least 2 chars and contain a letter
        // (rejects IP-only domains like "10.0.0.1")
        var tld = labels[^1];
        if (tld.Length < 2 || tld.Any(char.IsLetter) is false)
            return null;

        foreach (var label in labels)
        {
            if (label.Length == 0 || label.Length > 63 ||
                ConsecutiveDots.IsMatch(label) ||
                EdgeDot.IsMatch(label))
                return null;
        }

        return value;
    }
}
