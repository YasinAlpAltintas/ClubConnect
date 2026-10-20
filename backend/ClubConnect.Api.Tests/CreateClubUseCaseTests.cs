using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class CreateClubUseCaseTests
{
    private readonly Mock<IClubRepository> _clubRepository = new();

    [Fact]
    public async Task ExecuteAsync_ValidCommand_ReturnsSuccessOutcome()
    {
        var memberId = Guid.NewGuid();
        var clubId = Guid.NewGuid();
        var createdAt = DateTimeOffset.UtcNow;

        _clubRepository
            .Setup(r => r.CreateClubWithAdminAsync("Leuven Coding Society", "A tech community", memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club
            {
                Id = clubId,
                Name = "Leuven Coding Society",
                Description = "A tech community",
                CreatedAtUtc = createdAt
            });

        var useCase = new CreateClubUseCase(_clubRepository.Object);
        var command = new CreateClubCommand
        {
            Name = "  Leuven Coding Society  ",
            Description = "  A tech community  ",
            AdminMemberId = memberId
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(CreateClubStatus.Success, outcome.Status);
        Assert.Equal(clubId, outcome.ClubId);
        Assert.Equal("Leuven Coding Society", outcome.Name);
        Assert.Equal("A tech community", outcome.Description);
        Assert.Equal("Club Admin", outcome.Role);
        Assert.Equal(createdAt, outcome.CreatedAtUtc);
        Assert.Null(outcome.Violation);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ExecuteAsync_EmptyOrWhitespaceName_ReturnsInvalidInput(string? name)
    {
        var useCase = new CreateClubUseCase(_clubRepository.Object);
        var command = new CreateClubCommand
        {
            Name = name!,
            AdminMemberId = Guid.NewGuid()
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(CreateClubStatus.InvalidInput, outcome.Status);
        Assert.Equal("Club name is required.", outcome.Violation);
        _clubRepository.Verify(
            r => r.CreateClubWithAdminAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_NameTooShort_ReturnsInvalidInput()
    {
        var useCase = new CreateClubUseCase(_clubRepository.Object);
        var command = new CreateClubCommand
        {
            Name = "A",
            AdminMemberId = Guid.NewGuid()
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(CreateClubStatus.InvalidInput, outcome.Status);
        Assert.Contains("must be at least 2 characters", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_NameTooLong_ReturnsInvalidInput()
    {
        var useCase = new CreateClubUseCase(_clubRepository.Object);
        var command = new CreateClubCommand
        {
            Name = new string('x', 101),
            AdminMemberId = Guid.NewGuid()
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(CreateClubStatus.InvalidInput, outcome.Status);
        Assert.Contains("cannot exceed 100 characters", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_DescriptionTooLong_ReturnsInvalidInput()
    {
        var useCase = new CreateClubUseCase(_clubRepository.Object);
        var command = new CreateClubCommand
        {
            Name = "Valid Name",
            Description = new string('d', 501),
            AdminMemberId = Guid.NewGuid()
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(CreateClubStatus.InvalidInput, outcome.Status);
        Assert.Contains("cannot exceed 500 characters", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyMemberId_ReturnsInvalidInput()
    {
        var useCase = new CreateClubUseCase(_clubRepository.Object);
        var command = new CreateClubCommand
        {
            Name = "Valid Name",
            AdminMemberId = Guid.Empty
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(CreateClubStatus.InvalidInput, outcome.Status);
        Assert.Equal("Authenticated member ID is required.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_RepositoryThrows_ReturnsFailureOutcome()
    {
        _clubRepository
            .Setup(r => r.CreateClubWithAdminAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Database connection timeout"));

        var useCase = new CreateClubUseCase(_clubRepository.Object);
        var command = new CreateClubCommand
        {
            Name = "Valid Club",
            AdminMemberId = Guid.NewGuid()
        };

        var outcome = await useCase.ExecuteAsync(command, CancellationToken.None);

        Assert.Equal(CreateClubStatus.Failure, outcome.Status);
        Assert.Equal("Database connection timeout", outcome.Violation);
    }
}
