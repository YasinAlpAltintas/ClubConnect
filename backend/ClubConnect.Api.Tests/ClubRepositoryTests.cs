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
}
