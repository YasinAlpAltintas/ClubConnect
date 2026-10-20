namespace ClubConnect.Domain.Entities;

/// <summary>
/// A club workspace in ClubConnect.
/// Represents a student club, sports association, or academic society.
/// </summary>
public class Club
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>Display name of the club (e.g. "Leuven Coding Society").</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional summary or mission statement of the club.</summary>
    public string? Description { get; set; }

    /// <summary>Timestamp when the club was created in UTC.</summary>
    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Memberships linked to this club.</summary>
    public ICollection<Membership> Memberships { get; set; } = new List<Membership>();
}
