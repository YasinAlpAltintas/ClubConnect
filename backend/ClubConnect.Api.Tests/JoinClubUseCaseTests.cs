using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class JoinClubUseCaseTests
{
    private readonly Mock<IClubRepository> _clubRepository = new();

    [Fact]
    public async Task ExecuteAsync_ValidCommand_ReturnsSuccessOutcome()
    {
        var memberId = Guid.NewGuid();
        var clubId = Guid.NewGuid();
        var joinedAt = DateTimeOffset.UtcNow;

        _clubRepository
            .Setup(r => r.JoinClubByInviteCodeAsync("123456", memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new JoinClubResult(
                JoinClubRepositoryStatus.Success,
                ClubId: clubId,
                Name: "Leuven Robotics",
                Description: "Building bots",
                Role: "Club Member",
                JoinedAtUtc: joinedAt));

        var useCase = new JoinClubUseCase(_clubRepository.Object);
        var command = new JoinClubCommand
        {
            Code = "  123456  ",
            MemberId = memberId
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(JoinClubStatus.Success, outcome.Status);
        Assert.Equal(clubId, outcome.ClubId);
        Assert.Equal("Leuven Robotics", outcome.Name);
        Assert.Equal("Building bots", outcome.Description);
        Assert.Equal("Club Member", outcome.Role);
        Assert.Equal(joinedAt, outcome.JoinedAtUtc);
        Assert.Null(outcome.Violation);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ExecuteAsync_EmptyCode_ReturnsInvalidInput(string? code)
    {
        var useCase = new JoinClubUseCase(_clubRepository.Object);
        var command = new JoinClubCommand
        {
            Code = code!,
            MemberId = Guid.NewGuid()
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(JoinClubStatus.InvalidInput, outcome.Status);
        Assert.Equal("Invite code is required.", outcome.Violation);
        _clubRepository.Verify(
            r => r.JoinClubByInviteCodeAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Theory]
    [InlineData("12345")] // 5 digits
    [InlineData("1234567")] // 7 digits
    [InlineData("abcdef")] // letters
    [InlineData("12 345")] // internal whitespace
    [InlineData("12a456")] // alphanumeric
    public async Task ExecuteAsync_InvalidCodeFormat_ReturnsInvalidInput(string code)
    {
        var useCase = new JoinClubUseCase(_clubRepository.Object);
        var command = new JoinClubCommand
        {
            Code = code,
            MemberId = Guid.NewGuid()
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(JoinClubStatus.InvalidInput, outcome.Status);
        Assert.Equal("Invite code must consist of exactly 6 digits.", outcome.Violation);
        _clubRepository.Verify(
            r => r.JoinClubByInviteCodeAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyMemberId_ReturnsInvalidInput()
    {
        var useCase = new JoinClubUseCase(_clubRepository.Object);
        var command = new JoinClubCommand
        {
            Code = "123456",
            MemberId = Guid.Empty
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(JoinClubStatus.InvalidInput, outcome.Status);
        Assert.Equal("Authenticated member ID is required.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_CodeNotFound_ReturnsNotFoundOutcome()
    {
        var memberId = Guid.NewGuid();

        _clubRepository
            .Setup(r => r.JoinClubByInviteCodeAsync("999999", memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new JoinClubResult(
                JoinClubRepositoryStatus.NotFound,
                ErrorMessage: "Invalid or unknown invite code."));

        var useCase = new JoinClubUseCase(_clubRepository.Object);
        var command = new JoinClubCommand
        {
            Code = "999999",
            MemberId = memberId
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(JoinClubStatus.NotFound, outcome.Status);
        Assert.Equal("Invalid or unknown invite code.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_CodeExpired_ReturnsExpiredOutcome()
    {
        var memberId = Guid.NewGuid();

        _clubRepository
            .Setup(r => r.JoinClubByInviteCodeAsync("111111", memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new JoinClubResult(
                JoinClubRepositoryStatus.Expired,
                ErrorMessage: "The invite code has expired."));

        var useCase = new JoinClubUseCase(_clubRepository.Object);
        var command = new JoinClubCommand
        {
            Code = "111111",
            MemberId = memberId
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(JoinClubStatus.Expired, outcome.Status);
        Assert.Equal("The invite code has expired.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_AlreadyMember_ReturnsAlreadyMemberOutcome()
    {
        var memberId = Guid.NewGuid();
        var clubId = Guid.NewGuid();

        _clubRepository
            .Setup(r => r.JoinClubByInviteCodeAsync("222222", memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new JoinClubResult(
                JoinClubRepositoryStatus.AlreadyMember,
                ClubId: clubId,
                Name: "Existing Club",
                ErrorMessage: "You are already a member of this club."));

        var useCase = new JoinClubUseCase(_clubRepository.Object);
        var command = new JoinClubCommand
        {
            Code = "222222",
            MemberId = memberId
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(JoinClubStatus.AlreadyMember, outcome.Status);
        Assert.Equal(clubId, outcome.ClubId);
        Assert.Equal("Existing Club", outcome.Name);
        Assert.Equal("You are already a member of this club.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_RepositoryThrows_ReturnsFailureOutcome()
    {
        var memberId = Guid.NewGuid();

        _clubRepository
            .Setup(r => r.JoinClubByInviteCodeAsync("333333", memberId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Database connection failed."));

        var useCase = new JoinClubUseCase(_clubRepository.Object);
        var command = new JoinClubCommand
        {
            Code = "333333",
            MemberId = memberId
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(JoinClubStatus.Failure, outcome.Status);
        Assert.Equal("Database connection failed.", outcome.Violation);
    }
}
