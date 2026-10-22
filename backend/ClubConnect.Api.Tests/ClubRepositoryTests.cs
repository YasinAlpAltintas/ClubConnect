using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using ClubConnect.Infrastructure.Persistence;
using ClubConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ClubConnect.Api.Tests;

public class ClubRepositoryTests : IDisposable
{
    private readonly ClubConnectDbContext _context;

    public ClubRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<ClubConnectDbContext>()
            .UseInMemoryDatabase("clubs-" + Guid.NewGuid().ToString("N"))
            .Options;

        _context = new ClubConnectDbContext(options);
    }

    public void Dispose() => _context.Dispose();

    private ClubRepository NewRepository() => new(_context);

    private async Task<Member> SeedMemberAsync(string email = "test@example.com")
    {
        var member = new Member
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = "Test Member",
            PasswordHash = "hash",
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        await _context.Members.AddAsync(member);
        await _context.SaveChangesAsync();
        return member;
    }

    [Fact]
    public async Task CreateClubWithAdminAsync_PersistsClubAndAdminMembership()
    {
        var member = await SeedMemberAsync();
        var repository = NewRepository();

        var club = await repository.CreateClubWithAdminAsync(
            "Leuven Tech Community",
            "A campus developer community",
            member.Id,
            CancellationToken.None);

        Assert.NotNull(club);
        Assert.Equal("Leuven Tech Community", club.Name);
        Assert.Equal("A campus developer community", club.Description);

        // Verify Club in DB
        var savedClub = await _context.Clubs.SingleOrDefaultAsync(c => c.Id == club.Id);
        Assert.NotNull(savedClub);
        Assert.Equal("Leuven Tech Community", savedClub!.Name);

        // Verify Membership in DB with Club Admin role
        var savedMembership = await _context.Memberships.SingleOrDefaultAsync(m => m.ClubId == club.Id && m.MemberId == member.Id);
        Assert.NotNull(savedMembership);
        Assert.Equal("Club Admin", savedMembership!.Role);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateClubWithAdminAsync_EmptyOrWhitespaceName_Throws(string name)
    {
        var member = await SeedMemberAsync();
        var repository = NewRepository();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            repository.CreateClubWithAdminAsync(name, "desc", member.Id, CancellationToken.None));
    }

    [Fact]
    public async Task CreateClubWithAdminAsync_EmptyMemberId_Throws()
    {
        var repository = NewRepository();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            repository.CreateClubWithAdminAsync("Valid Club", "desc", Guid.Empty, CancellationToken.None));
    }

    [Fact]
    public async Task GetClubsForMemberAsync_ReturnsOnlyClubsForGivenMember_MultiTenantIsolation()
    {
        var member1 = await SeedMemberAsync("member1@example.com");
        var member2 = await SeedMemberAsync("member2@example.com");
        var repository = NewRepository();

        var club1 = await repository.CreateClubWithAdminAsync("Member 1 Club Alpha", "Alpha", member1.Id, CancellationToken.None);
        var club2 = await repository.CreateClubWithAdminAsync("Member 1 Club Beta", "Beta", member1.Id, CancellationToken.None);
        var club3 = await repository.CreateClubWithAdminAsync("Member 2 Club Gamma", "Gamma", member2.Id, CancellationToken.None);

        var member1Clubs = await repository.GetClubsForMemberAsync(member1.Id, CancellationToken.None);
        var member2Clubs = await repository.GetClubsForMemberAsync(member2.Id, CancellationToken.None);

        Assert.Equal(2, member1Clubs.Count);
        Assert.Contains(member1Clubs, c => c.Id == club1.Id && c.Name == "Member 1 Club Alpha" && c.Role == "Club Admin");
        Assert.Contains(member1Clubs, c => c.Id == club2.Id && c.Name == "Member 1 Club Beta" && c.Role == "Club Admin");
        Assert.DoesNotContain(member1Clubs, c => c.Id == club3.Id);

        Assert.Single(member2Clubs);
        Assert.Equal(club3.Id, member2Clubs[0].Id);
        Assert.Equal("Member 2 Club Gamma", member2Clubs[0].Name);
    }

    [Fact]
    public async Task GetByIdAsync_KnownId_ReturnsClubWithMemberships()
    {
        var member = await SeedMemberAsync();
        var repository = NewRepository();
        var created = await repository.CreateClubWithAdminAsync("Robotics Club", null, member.Id, CancellationToken.None);

        var found = await repository.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(found);
        Assert.Equal(created.Id, found!.Id);
        Assert.Equal("Robotics Club", found.Name);
        Assert.Single(found.Memberships);
        Assert.Equal(member.Id, found.Memberships.First().MemberId);
    }

    [Fact]
    public async Task GetByIdAsync_UnknownId_ReturnsNull()
    {
        var repository = NewRepository();
        var found = await repository.GetByIdAsync(Guid.NewGuid(), CancellationToken.None);
        Assert.Null(found);
    }

    [Fact]
    public async Task CreateClubWithAdminAsync_GeneratesActive6DigitInviteCode()
    {
        var member = await SeedMemberAsync();
        var repository = NewRepository();

        var club = await repository.CreateClubWithAdminAsync("Music Society", "Instruments", member.Id, CancellationToken.None);

        var invite = await _context.ClubInvites.SingleOrDefaultAsync(i => i.ClubId == club.Id);
        Assert.NotNull(invite);
        Assert.True(invite!.IsActive);
        Assert.Matches(@"^\d{6}$", invite.Code);

        // Verify invite code is populated in summary for Admin
        var clubs = await repository.GetClubsForMemberAsync(member.Id, CancellationToken.None);
        var adminClub = clubs.Single(c => c.Id == club.Id);
        Assert.Equal("Club Admin", adminClub.Role);
        Assert.Equal(invite.Code, adminClub.InviteCode);
    }

    [Fact]
    public async Task JoinClubByInviteCodeAsync_ValidCode_SuccessfullyJoinsAsClubMember()
    {
        var admin = await SeedMemberAsync("admin@example.com");
        var joiner = await SeedMemberAsync("joiner@example.com");
        var repository = NewRepository();

        var club = await repository.CreateClubWithAdminAsync("Chess Club", "Grandmasters", admin.Id, CancellationToken.None);
        var activeInvite = await _context.ClubInvites.SingleAsync(i => i.ClubId == club.Id);

        var result = await repository.JoinClubByInviteCodeAsync(activeInvite.Code, joiner.Id, CancellationToken.None);

        Assert.Equal(JoinClubRepositoryStatus.Success, result.Status);
        Assert.Equal(club.Id, result.ClubId);
        Assert.Equal("Chess Club", result.Name);
        Assert.Equal("Grandmasters", result.Description);
        Assert.Equal("Club Member", result.Role);

        // Verify membership created in DB
        var membership = await _context.Memberships.SingleOrDefaultAsync(m => m.ClubId == club.Id && m.MemberId == joiner.Id);
        Assert.NotNull(membership);
        Assert.Equal("Club Member", membership!.Role);

        // Verify joiner gets null invite code in club list (only Admins see invite code)
        var joinerClubs = await repository.GetClubsForMemberAsync(joiner.Id, CancellationToken.None);
        var joinedSummary = joinerClubs.Single(c => c.Id == club.Id);
        Assert.Equal("Club Member", joinedSummary.Role);
        Assert.Null(joinedSummary.InviteCode);
    }

    [Fact]
    public async Task JoinClubByInviteCodeAsync_UnknownCode_ReturnsNotFound()
    {
        var joiner = await SeedMemberAsync("joiner-notfound@example.com");
        var repository = NewRepository();

        var result = await repository.JoinClubByInviteCodeAsync("999999", joiner.Id, CancellationToken.None);

        Assert.Equal(JoinClubRepositoryStatus.NotFound, result.Status);
        Assert.Contains("Invalid or unknown invite code", result.ErrorMessage);
    }

    [Fact]
    public async Task JoinClubByInviteCodeAsync_ExpiredCode_ReturnsExpired()
    {
        var admin = await SeedMemberAsync("admin-expired@example.com");
        var joiner = await SeedMemberAsync("joiner-expired@example.com");
        var repository = NewRepository();

        var club = await repository.CreateClubWithAdminAsync("Expired Club", null, admin.Id, CancellationToken.None);
        var invite = await _context.ClubInvites.SingleAsync(i => i.ClubId == club.Id);
        invite.ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(-10);
        await _context.SaveChangesAsync();

        var result = await repository.JoinClubByInviteCodeAsync(invite.Code, joiner.Id, CancellationToken.None);

        Assert.Equal(JoinClubRepositoryStatus.Expired, result.Status);
        Assert.Contains("expired", result.ErrorMessage);
    }

    [Fact]
    public async Task JoinClubByInviteCodeAsync_AlreadyMember_ReturnsAlreadyMember()
    {
        var admin = await SeedMemberAsync("admin-already@example.com");
        var repository = NewRepository();

        var club = await repository.CreateClubWithAdminAsync("Already Club", null, admin.Id, CancellationToken.None);
        var invite = await _context.ClubInvites.SingleAsync(i => i.ClubId == club.Id);

        // Admin tries to join their own club using the invite code
        var result = await repository.JoinClubByInviteCodeAsync(invite.Code, admin.Id, CancellationToken.None);

        Assert.Equal(JoinClubRepositoryStatus.AlreadyMember, result.Status);
        Assert.Equal(club.Id, result.ClubId);
        Assert.Contains("already a member", result.ErrorMessage);
    }

    [Fact]
    public async Task GetClubForMemberAsync_NonExistentClub_ReturnsNull()
    {
        var member = await SeedMemberAsync("member-notfound@example.com");
        var repository = NewRepository();

        var result = await repository.GetClubForMemberAsync(Guid.NewGuid(), member.Id, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetClubForMemberAsync_UserNotMember_ReturnsNull_EnforcesTenantIsolation()
    {
        var admin = await SeedMemberAsync("admin-tenant@example.com");
        var stranger = await SeedMemberAsync("stranger-tenant@example.com");
        var repository = NewRepository();

        var club = await repository.CreateClubWithAdminAsync("Tenant Protected Club", "Secret", admin.Id, CancellationToken.None);

        // Stranger attempts to access club
        var result = await repository.GetClubForMemberAsync(club.Id, stranger.Id, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetClubForMemberAsync_UserIsAdmin_ReturnsClubWithInviteCode()
    {
        var admin = await SeedMemberAsync("admin-detail@example.com");
        var repository = NewRepository();

        var club = await repository.CreateClubWithAdminAsync("Admin Detail Club", "Description", admin.Id, CancellationToken.None);

        var result = await repository.GetClubForMemberAsync(club.Id, admin.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(club.Id, result!.Id);
        Assert.Equal("Admin Detail Club", result.Name);
        Assert.Equal("Description", result.Description);
        Assert.Equal("Club Admin", result.Role);
        Assert.NotNull(result.InviteCode);
        Assert.Matches(@"^\d{6}$", result.InviteCode);
    }

    [Fact]
    public async Task GetClubForMemberAsync_UserIsMember_ReturnsClubWithNullInviteCode()
    {
        var admin = await SeedMemberAsync("admin-memdetail@example.com");
        var joiner = await SeedMemberAsync("joiner-memdetail@example.com");
        var repository = NewRepository();

        var club = await repository.CreateClubWithAdminAsync("Member Detail Club", "Description", admin.Id, CancellationToken.None);
        var invite = await _context.ClubInvites.SingleAsync(i => i.ClubId == club.Id);

        await repository.JoinClubByInviteCodeAsync(invite.Code, joiner.Id, CancellationToken.None);

        var result = await repository.GetClubForMemberAsync(club.Id, joiner.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(club.Id, result!.Id);
        Assert.Equal("Member Detail Club", result.Name);
        Assert.Equal("Club Member", result.Role);
        Assert.Null(result.InviteCode); // Non-admins must not see invite code
    }
}
