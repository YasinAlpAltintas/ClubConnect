using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using ClubConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClubConnect.Infrastructure.Repositories;

/// <summary>
/// Npgsql/EF Core implementation of <see cref="IMemberRepository"/>.
/// </summary>
public sealed class MemberRepository(ClubConnectDbContext context) : IMemberRepository
{
    public async Task<Member> AddAsync(Member member, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(member);
        await context.Members.AddAsync(member, cancellationToken).ConfigureAwait(false);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return member;
    }

    public Task<Member?> FindByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(email);
        return context.Members
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Email == email, cancellationToken);
    }

    public Task<Member?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return context.Members
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
    }
}
