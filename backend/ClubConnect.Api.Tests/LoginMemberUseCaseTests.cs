using ClubConnect.Application.Abstractions;
using ClubConnect.Application.Members;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class LoginMemberUseCaseTests
{
    private readonly Mock<IMemberRepository> _members = new();
    private readonly Mock<IPasswordHasher> _hasher = new();

    private LoginMemberUseCase NewUseCase() => new(_members.Object, _hasher.Object);

    [Fact]
    public void Constructor_NullMembers_ThrowsArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new LoginMemberUseCase(null!, _hasher.Object));
    }

    [Fact]
    public void Constructor_NullHasher_ThrowsArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new LoginMemberUseCase(_members.Object, null!));
    }

    [Fact]
    public async Task ExecuteAsync_NullCommand_ReturnsInvalidInput()
    {
        var useCase = NewUseCase();
        var outcome = await useCase.ExecuteAsync(null!);

        Assert.Equal(LoginStatus.InvalidInput, outcome.Status);
        Assert.Equal("Email and password are required.", outcome.Violation);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ExecuteAsync_EmptyPassword_ReturnsInvalidInput(string? password)
    {
        var useCase = NewUseCase();
        var outcome = await useCase.ExecuteAsync(new LoginMemberCommand { Email = "valid@example.com", Password = password! });

        Assert.Equal(LoginStatus.InvalidInput, outcome.Status);
        _members.Verify(m => m.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-an-email")]
    [InlineData("user@")]
    public async Task ExecuteAsync_InvalidEmail_ReturnsInvalidInput(string? email)
    {
        var useCase = NewUseCase();
        var outcome = await useCase.ExecuteAsync(new LoginMemberCommand { Email = email!, Password = "SomePassword1!" });

        Assert.Equal(LoginStatus.InvalidInput, outcome.Status);
        Assert.Equal("E-mail is not valid.", outcome.Violation);
        _members.Verify(m => m.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_MemberNotFound_ReturnsInvalidCredentials()
    {
        var useCase = NewUseCase();
        _members.Setup(m => m.FindByEmailAsync("unknown@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        var outcome = await useCase.ExecuteAsync(new LoginMemberCommand { Email = "Unknown@Example.COM", Password = "Passw0rd123" });

        Assert.Equal(LoginStatus.InvalidCredentials, outcome.Status);
        Assert.Equal("Invalid email or password.", outcome.Violation);
        _hasher.Verify(h => h.Verify(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_PasswordMismatch_ReturnsInvalidCredentials()
    {
        var useCase = NewUseCase();
        _members.Setup(m => m.FindByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Member
            {
                Id = Guid.NewGuid(),
                Email = "user@example.com",
                PasswordHash = "stored_hash"
            });
        _hasher.Setup(h => h.Verify("WrongPassword", "stored_hash")).Returns(false);

        var outcome = await useCase.ExecuteAsync(new LoginMemberCommand { Email = "user@example.com", Password = "WrongPassword" });

        Assert.Equal(LoginStatus.InvalidCredentials, outcome.Status);
        Assert.Equal("Invalid email or password.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_ValidCredentials_ReturnsSuccessWithMemberProfile()
    {
        var useCase = NewUseCase();
        var memberId = Guid.NewGuid();
        _members.Setup(m => m.FindByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Member
            {
                Id = memberId,
                Email = "user@example.com",
                DisplayName = "John Doe",
                PasswordHash = "correct_hash"
            });
        _hasher.Setup(h => h.Verify("CorrectPassword1!", "correct_hash")).Returns(true);

        var outcome = await useCase.ExecuteAsync(new LoginMemberCommand { Email = " USER@Example.COM ", Password = "CorrectPassword1!" });

        Assert.Equal(LoginStatus.Success, outcome.Status);
        Assert.Equal(memberId, outcome.MemberId);
        Assert.Equal("user@example.com", outcome.Email);
        Assert.Equal("John Doe", outcome.DisplayName);
    }
}
