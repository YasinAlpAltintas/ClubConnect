using ClubConnect.Domain.Entities;

namespace ClubConnect.Domain.Abstractions;

/// <summary>
/// Persistence contract for <see cref="Member"/> records.
/// Kept in the Domain so the Application layer never depends on EF Core.
/// </summary>
public interface IMemberRepository
{
    /// <summary>Creates a new member.</summary>
    Task<Member> AddAsync(Member member, CancellationToken cancellationToken = default);

    /// <summary>Returns the member with the given canonical <paramref name="email"/>, or null.</summary>
    Task<Member?> FindByEmailAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>Returns the member with the given <paramref name="id"/>, or null.</summary>
    Task<Member?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default);
}
