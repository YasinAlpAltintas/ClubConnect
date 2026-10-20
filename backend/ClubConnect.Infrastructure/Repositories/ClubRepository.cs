using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using ClubConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClubConnect.Infrastructure.Repositories;

/// <summary>
/// EF Core implementation of <see cref="IClubRepository"/>.
/// Manages clubs and member role associations within transactional boundaries.
/// </summary>
public sealed class ClubRepository(ClubConnectDbContext context) : IClubRepository
{
    public async Task<Club> CreateClubWithAdminAsync(
        string name,
        string? description,
        Guid adminMemberId,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (adminMemberId == Guid.Empty)
        {
            throw new ArgumentException("Admin member ID must be a valid non-empty GUID.", nameof(adminMemberId));
        }

        var club = new Club
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        var membership = new Membership
        {
            Id = Guid.NewGuid(),
            ClubId = club.Id,
            MemberId = adminMemberId,
            Role = "Club Admin",
            JoinedAtUtc = DateTimeOffset.UtcNow
        };

        var supportsTransactions = context.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory";

        if (supportsTransactions)
        {
            await using var transaction = await context.Database
                .BeginTransactionAsync(cancellationToken)
                .ConfigureAwait(false);

            try
            {
                await context.Clubs.AddAsync(club, cancellationToken).ConfigureAwait(false);
                await context.Memberships.AddAsync(membership, cancellationToken).ConfigureAwait(false);
                await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                return club;
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                throw;
            }
        }
        else
        {
            await context.Clubs.AddAsync(club, cancellationToken).ConfigureAwait(false);
            await context.Memberships.AddAsync(membership, cancellationToken).ConfigureAwait(false);
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return club;
        }
    }

    public async Task<IReadOnlyList<ClubMembershipSummary>> GetClubsForMemberAsync(
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var memberships = await context.Memberships
            .AsNoTracking()
            .Where(m => m.MemberId == memberId)
            .OrderBy(m => m.JoinedAtUtc)
            .Select(m => new ClubMembershipSummary(
                m.ClubId,
                m.Club!.Name,
                m.Club.Description,
                m.Role))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return memberships;
    }

    public Task<Club?> GetByIdAsync(Guid clubId, CancellationToken cancellationToken)
    {
        return context.Clubs
            .AsNoTracking()
            .Include(c => c.Memberships)
            .FirstOrDefaultAsync(c => c.Id == clubId, cancellationToken);
    }
}
