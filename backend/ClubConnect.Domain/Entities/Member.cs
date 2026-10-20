namespace ClubConnect.Domain.Entities;

/// <summary>
/// A club member account. This is the core identity record for ClubConnect.
/// The stored <see cref="PasswordHash"/> is never the plaintext password.
/// </summary>
public class Member
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>Canonical (lower-cased, trimmed) member e-mail address. Unique.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Argon2id hash of the member's chosen password.</summary>
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>Free-form display name the member chooses for their account.</summary>
    public string DisplayName { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; init; }

    /// <summary>Memberships held by this member across various clubs.</summary>
    public ICollection<Membership> Memberships { get; set; } = new List<Membership>();
}
