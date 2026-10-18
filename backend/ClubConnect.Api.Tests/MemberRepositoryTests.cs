using ClubConnect.Domain.Entities;
using ClubConnect.Infrastructure.Persistence;
using ClubConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ClubConnect.Api.Tests;

public class MemberRepositoryTests : IDisposable
{
    private readonly ClubConnectDbContext _context;

    public MemberRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<ClubConnectDbContext>()
            .UseInMemoryDatabase("members-" + Guid.NewGuid().ToString("N"))
            .Options;

        _context = new ClubConnectDbContext(options);
    }

    public void Dispose() => _context.Dispose();

    private MemberRepository NewRepository() => new(_context);

    private static Member NewMember(string email = "user@example.com") => new()
    {
        Email = email,
        PasswordHash = "hash",
        DisplayName = "User",
        CreatedAtUtc = DateTimeOffset.UtcNow,
    };

    [Fact]
    public async Task AddAsync_Persists_AndReturnsSameInstance()
    {
        var repository = NewRepository();
        var member = NewMember();

        var saved = await repository.AddAsync(member);

        Assert.Same(member, saved);
        Assert.Equal(1, await _context.Members.CountAsync());
        Assert.Equal(member.Email, (await _context.Members.SingleAsync()).Email);
    }

    [Fact]
    public async Task AddAsync_NullMember_Throws()
    {
        var repository = NewRepository();

        await Assert.ThrowsAsync<ArgumentNullException>(() => repository.AddAsync(null));
    }

    [Fact]
    public async Task FindByEmailAsync_KnownEmail_ReturnsMember()
    {
        var repository = NewRepository();
        var created = await repository.AddAsync(NewMember("found@example.com"));

        var found = await repository.FindByEmailAsync("found@example.com");

        Assert.NotNull(found);
        Assert.Equal(created.Id, found!.Id);
    }

    [Fact]
    public async Task FindByEmailAsync_UnknownEmail_ReturnsNull()
    {
        var repository = NewRepository();
        await repository.AddAsync(NewMember("other@example.com"));

        var found = await repository.FindByEmailAsync("missing@example.com");

        Assert.Null(found);
    }

    [Fact]
    public async Task FindByEmailAsync_EmptyEmail_Throws()
    {
        var repository = NewRepository();

        await Assert.ThrowsAsync<ArgumentException>(() => repository.FindByEmailAsync(""));
    }

    [Fact]
    public async Task FindByEmailAsync_NullEmail_Throws()
    {
        var repository = NewRepository();

        await Assert.ThrowsAnyAsync<ArgumentException>(() => repository.FindByEmailAsync(null));
    }

    [Fact]
    public async Task FindByIdAsync_KnownId_ReturnsMember()
    {
        var repository = NewRepository();
        var created = await repository.AddAsync(NewMember());

        var found = await repository.FindByIdAsync(created.Id);

        Assert.NotNull(found);
        Assert.Equal(created.Email, found!.Email);
    }

    [Fact]
    public async Task FindByIdAsync_UnknownId_ReturnsNull()
    {
        var repository = NewRepository();
        await repository.AddAsync(NewMember());

        var found = await repository.FindByIdAsync(Guid.NewGuid());

        Assert.Null(found);
    }
}
