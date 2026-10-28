using System.Security.Cryptography;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using ClubConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClubConnect.Infrastructure.Repositories;

/// <summary>
/// EF Core implementation of <see cref="IClubRepository"/>.
/// Manages clubs, member role associations, and 6-digit invite codes within transactional boundaries.
/// </summary>
public sealed class ClubRepository(ClubConnectDbContext context) : IClubRepository
{
    private static string GenerateSixDigitCode()
    {
        var num = RandomNumberGenerator.GetInt32(0, 1_000_000);
        return num.ToString("D6");
    }

    private async Task<string> GenerateUniqueInviteCodeAsync(CancellationToken cancellationToken)
    {
        const int maxAttempts = 15;
        for (var i = 0; i < maxAttempts; i++)
        {
            var code = GenerateSixDigitCode();
            var exists = await context.ClubInvites
                .AnyAsync(ci => ci.Code == code && ci.IsActive, cancellationToken)
                .ConfigureAwait(false);

            if (!exists)
            {
                return code;
            }
        }

        throw new InvalidOperationException("Failed to generate a unique 6-digit invite code after multiple attempts.");
    }

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

        var inviteCode = await GenerateUniqueInviteCodeAsync(cancellationToken).ConfigureAwait(false);
        var invite = new ClubInvite
        {
            Id = Guid.NewGuid(),
            ClubId = club.Id,
            Code = inviteCode,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            IsActive = true
        };

        club.Memberships.Add(membership);
        club.Invites.Add(invite);

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
                await context.ClubInvites.AddAsync(invite, cancellationToken).ConfigureAwait(false);
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
            await context.ClubInvites.AddAsync(invite, cancellationToken).ConfigureAwait(false);
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return club;
        }
    }

    public async Task<IReadOnlyList<ClubMembershipSummary>> GetClubsForMemberAsync(
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var rawMemberships = await context.Memberships
            .AsNoTracking()
            .Where(m => m.MemberId == memberId)
            .OrderBy(m => m.JoinedAtUtc)
            .Select(m => new
            {
                m.ClubId,
                Name = m.Club!.Name,
                Description = m.Club.Description,
                Role = m.Role,
                InviteCode = m.Role == "Club Admin"
                    ? m.Club.Invites.Where(i => i.IsActive).Select(i => i.Code).FirstOrDefault()
                    : null
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return rawMemberships
            .Select(m => new ClubMembershipSummary(
                m.ClubId,
                m.Name,
                m.Description,
                m.Role,
                m.InviteCode))
            .ToList();
    }

    public async Task<ClubMembershipSummary?> GetClubForMemberAsync(
        Guid clubId,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var membership = await context.Memberships
            .AsNoTracking()
            .Where(m => m.ClubId == clubId && m.MemberId == memberId)
            .Select(m => new
            {
                m.ClubId,
                Name = m.Club!.Name,
                Description = m.Club.Description,
                Role = m.Role,
                InviteCode = m.Role == "Club Admin"
                    ? m.Club.Invites.Where(i => i.IsActive).Select(i => i.Code).FirstOrDefault()
                    : null
            })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (membership is null)
        {
            return null;
        }

        return new ClubMembershipSummary(
            membership.ClubId,
            membership.Name,
            membership.Description,
            membership.Role,
            membership.InviteCode);
    }

    public Task<Club?> GetByIdAsync(Guid clubId, CancellationToken cancellationToken)
    {
        return context.Clubs
            .AsNoTracking()
            .Include(c => c.Memberships)
            .Include(c => c.Invites)
            .FirstOrDefaultAsync(c => c.Id == clubId, cancellationToken);
    }

    public Task<ClubInvite?> GetActiveInviteCodeAsync(string code, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        var cleanCode = code.Trim();
        return context.ClubInvites
            .AsNoTracking()
            .Include(ci => ci.Club)
            .FirstOrDefaultAsync(ci => ci.Code == cleanCode && ci.IsActive, cancellationToken);
    }

    public Task<ClubInvite?> GetInviteCodeForClubAsync(Guid clubId, CancellationToken cancellationToken)
    {
        return context.ClubInvites
            .AsNoTracking()
            .FirstOrDefaultAsync(ci => ci.ClubId == clubId && ci.IsActive, cancellationToken);
    }

    public async Task<JoinClubResult> JoinClubByInviteCodeAsync(
        string code,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        if (memberId == Guid.Empty)
        {
            throw new ArgumentException("Member ID must be a valid non-empty GUID.", nameof(memberId));
        }

        var cleanCode = code.Trim();

        var invite = await context.ClubInvites
            .Include(i => i.Club)
            .FirstOrDefaultAsync(i => i.Code == cleanCode && i.IsActive, cancellationToken)
            .ConfigureAwait(false);

        if (invite is null)
        {
            return new JoinClubResult(JoinClubRepositoryStatus.NotFound, ErrorMessage: "Invalid or unknown invite code.");
        }

        if (invite.ExpiresAtUtc.HasValue && invite.ExpiresAtUtc.Value <= DateTimeOffset.UtcNow)
        {
            return new JoinClubResult(JoinClubRepositoryStatus.Expired, ErrorMessage: "The invite code has expired.");
        }

        // Check if member already belongs to the club
        var existingMembership = await context.Memberships
            .AsNoTracking()
            .AnyAsync(m => m.ClubId == invite.ClubId && m.MemberId == memberId, cancellationToken)
            .ConfigureAwait(false);

        if (existingMembership)
        {
            return new JoinClubResult(
                JoinClubRepositoryStatus.AlreadyMember,
                ClubId: invite.ClubId,
                Name: invite.Club?.Name,
                ErrorMessage: "You are already a member of this club.");
        }

        var membership = new Membership
        {
            Id = Guid.NewGuid(),
            ClubId = invite.ClubId,
            MemberId = memberId,
            Role = "Club Member",
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
                var alreadyJoined = await context.Memberships
                    .AnyAsync(m => m.ClubId == invite.ClubId && m.MemberId == memberId, cancellationToken)
                    .ConfigureAwait(false);

                if (alreadyJoined)
                {
                    await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                    return new JoinClubResult(
                        JoinClubRepositoryStatus.AlreadyMember,
                        ClubId: invite.ClubId,
                        Name: invite.Club?.Name,
                        ErrorMessage: "You are already a member of this club.");
                }

                await context.Memberships.AddAsync(membership, cancellationToken).ConfigureAwait(false);
                await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (DbUpdateException)
            {
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                return new JoinClubResult(
                    JoinClubRepositoryStatus.AlreadyMember,
                    ClubId: invite.ClubId,
                    Name: invite.Club?.Name,
                    ErrorMessage: "You are already a member of this club.");
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                throw;
            }
        }
        else
        {
            try
            {
                await context.Memberships.AddAsync(membership, cancellationToken).ConfigureAwait(false);
                await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (DbUpdateException)
            {
                return new JoinClubResult(
                    JoinClubRepositoryStatus.AlreadyMember,
                    ClubId: invite.ClubId,
                    Name: invite.Club?.Name,
                    ErrorMessage: "You are already a member of this club.");
            }
        }

        return new JoinClubResult(
            JoinClubRepositoryStatus.Success,
            ClubId: invite.ClubId,
            Name: invite.Club?.Name,
            Description: invite.Club?.Description,
            Role: "Club Member",
            JoinedAtUtc: membership.JoinedAtUtc);
    }

    public async Task<IReadOnlyList<ClubMemberDetail>> GetMembersForClubAsync(
        Guid clubId,
        CancellationToken cancellationToken)
    {
        var members = await context.Memberships
            .AsNoTracking()
            .Where(m => m.ClubId == clubId)
            .OrderBy(m => m.Member!.DisplayName != null && m.Member.DisplayName != "" ? m.Member.DisplayName : m.Member!.Email)
            .ThenBy(m => m.MemberId)
            .Select(m => new ClubMemberDetail(
                m.MemberId,
                m.Member!.DisplayName ?? string.Empty,
                m.Member.Email,
                m.Role,
                m.JoinedAtUtc))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return members;
    }

    public Task<bool> IsClubAdminAsync(
        Guid clubId,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        return context.Memberships
            .AsNoTracking()
            .AnyAsync(m => m.ClubId == clubId && m.MemberId == memberId && m.Role == "Club Admin", cancellationToken);
    }
}
