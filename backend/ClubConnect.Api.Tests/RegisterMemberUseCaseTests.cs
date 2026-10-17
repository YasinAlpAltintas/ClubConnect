using ClubConnect.Application.Abstractions;
using ClubConnect.Application.Members;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class RegisterMemberUseCaseTests
{
    private readonly Mock<IMemberRepository> _members = new();
    private readonly Mock<IPasswordHasher> _hasher = new();

    private RegisterMemberUseCase NewUseCase() => new(_members.Object, _hasher.Object);

    private static RegisterMemberCommand ValidCommand(string email = "User@Example.COM.be", string password = "Passw0rd") =>
        new() { Email = email, Password = password };

    [Fact]
    public async Task ExecuteAsync_NullMembers_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => new RegisterMemberUseCase(null, _hasher.Object));
    }

    [Fact]
    public async Task ExecuteAsync_NullHasher_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => new RegisterMemberUseCase(_members.Object, null));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-an-email")]
    [InlineData("user@")]
    [InlineData("user@@example.com")]
    [InlineData("user@10.0.0.1")]
    [InlineData("a user@example.com")]
    public async Task ExecuteAsync_InvalidEmail_ReturnsInvalid_AndSkipsPersistence(string? email)
    {
        var useCase = NewUseCase();

        var outcome = await useCase.ExecuteAsync(new RegisterMemberCommand { Email = email, Password = "Passw0rd" });

        Assert.Equal(RegisterStatus.Invalid, outcome.Status);
        Assert.Equal("E-mail is not valid.", outcome.Violation);
        Assert.False(outcome.MemberId.HasValue);
        _members.Verify(m => m.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _members.Verify(m => m.AddAsync(It.IsAny<Member>(), It.IsAny<CancellationToken>()), Times.Never);
        _hasher.Verify(h => h.Hash(It.IsAny<string>()), Times.Never);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("12345678")]
    [InlineData("onlyletters")]
    public async Task ExecuteAsync_InvalidPassword_ReturnsInvalid_AndSkipsPersistence(string? password)
    {
        var useCase = NewUseCase();

        var outcome = await useCase.ExecuteAsync(new RegisterMemberCommand { Email = "user@example.com", Password = password });

        Assert.Equal(RegisterStatus.Invalid, outcome.Status);
        Assert.NotNull(outcome.Violation);
        Assert.False(outcome.MemberId.HasValue);
        _members.Verify(m => m.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _members.Verify(m => m.AddAsync(It.IsAny<Member>(), It.IsAny<CancellationToken>()), Times.Never);
        _hasher.Verify(h => h.Hash(It.IsAny<string>()), Times.Never);
    }

    [Theory]
    [InlineData(null, "Password is required.")]
    [InlineData("", "Password is required.")]
    [InlineData("abc", "Password must be at least 8 characters long.")]
    [InlineData("12345678", "Password must contain at least one letter.")]
    [InlineData("onlyletters", "Password must contain at least one digit.")]
    public async Task ExecuteAsync_InvalidPassword_ReturnsExpectedMessage(string? password, string expectedMessage)
    {
        var useCase = NewUseCase();

        var outcome = await useCase.ExecuteAsync(new RegisterMemberCommand { Email = "user@example.com", Password = password });

        Assert.Equal(expectedMessage, outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_DuplicateEmail_ReturnsConflict_AndNeverHashes()
    {
        _members
            .Setup(m => m.FindByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Member { Email = "user@example.com", PasswordHash = "hash" });

        var useCase = NewUseCase();

        var outcome = await useCase.ExecuteAsync(ValidCommand("USER@example.COM", "Passw0rd"));

        Assert.Equal(RegisterStatus.Conflict, outcome.Status);
        Assert.False(outcome.MemberId.HasValue);
        _hasher.Verify(h => h.Hash(It.IsAny<string>()), Times.Never);
        _members.Verify(m => m.AddAsync(It.IsAny<Member>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_ValidCommand_CreatesMember_WhenEmailIsNew()
    {
        _members
            .Setup(m => m.FindByEmailAsync("user@example.com.be", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);
        _hasher
            .Setup(h => h.Hash("Passw0rd"))
            .Returns("$argon2id$hash");
        _members
            .Setup(m => m.AddAsync(It.IsAny<Member>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member member, CancellationToken _) => member);

        var useCase = NewUseCase();
        var before = DateTimeOffset.UtcNow;

        var outcome = await useCase.ExecuteAsync(
            new RegisterMemberCommand { Email = "  USER@Example.COM.be ", Password = "Passw0rd", DisplayName = "  Ada  " });

        Assert.Equal(RegisterStatus.Created, outcome.Status);
        Assert.True(outcome.MemberId.HasValue);
        Assert.Equal("user@example.com.be", outcome.NormalizedEmail);
        Assert.Null(outcome.Violation);

        _members.Verify(
            m => m.AddAsync(It.Is<Member>(x =>
                x.Email == "user@example.com.be" &&
                x.PasswordHash == "$argon2id$hash" &&
                x.DisplayName == "Ada" &&
                x.Id == outcome.MemberId &&
                x.CreatedAtUtc >= before &&
                x.CreatedAtUtc <= DateTimeOffset.UtcNow),
            It.IsAny<CancellationToken>()),
            Times.Once);
        _hasher.Verify(h => h.Hash("Passw0rd"), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyDisplayName_IsAccepted()
    {
        _members
            .Setup(m => m.FindByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);
        _hasher
            .Setup(h => h.Hash(It.IsAny<string>()))
            .Returns((string s) => "hash:" + s);
        _members
            .Setup(m => m.AddAsync(It.IsAny<Member>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member member, CancellationToken _) => member);

        var useCase = NewUseCase();

        var outcome = await useCase.ExecuteAsync(ValidCommand());

        Assert.Equal(RegisterStatus.Created, outcome.Status);
        _members.Verify(
            m => m.AddAsync(It.Is<Member>(x => x.DisplayName == string.Empty), It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
