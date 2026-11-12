using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class UpdateMemberRoleUseCaseTests
{
    private readonly Mock<IClubRepository> _clubRepoMock = new();

    private UpdateMemberRoleUseCase CreateUseCase() => new(_clubRepoMock.Object);

    [Fact]
    public async Task ExecuteAsync_NullCommand_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(null!);

        Assert.Equal(UpdateMemberRoleStatus.InvalidInput, outcome.Status);
        Assert.Equal("Command cannot be null.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyClubId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateMemberRoleCommand
        {
            ClubId = Guid.Empty,
            RequestingMemberId = Guid.NewGuid(),
            TargetMemberId = Guid.NewGuid(),
            Role = "Club Admin"
        });

        Assert.Equal(UpdateMemberRoleStatus.InvalidInput, outcome.Status);
        Assert.Equal("Club ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyRequestingMemberId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateMemberRoleCommand
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = Guid.Empty,
            TargetMemberId = Guid.NewGuid(),
            Role = "Club Admin"
        });

        Assert.Equal(UpdateMemberRoleStatus.InvalidInput, outcome.Status);
        Assert.Equal("Requesting member ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyTargetMemberId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateMemberRoleCommand
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = Guid.NewGuid(),
            TargetMemberId = Guid.Empty,
            Role = "Club Admin"
        });

        Assert.Equal(UpdateMemberRoleStatus.InvalidInput, outcome.Status);
        Assert.Equal("Target member ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("SuperAdmin")]
    [InlineData("Moderator")]
    public async Task ExecuteAsync_InvalidRole_ReturnsInvalidInput(string role)
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateMemberRoleCommand
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = Guid.NewGuid(),
            TargetMemberId = Guid.NewGuid(),
            Role = role
        });

        Assert.Equal(UpdateMemberRoleStatus.InvalidInput, outcome.Status);
        Assert.Equal("Role must be either 'Club Admin' or 'Club Member'.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_ClubDoesNotExist_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Club?)null);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateMemberRoleCommand
        {
            ClubId = clubId,
            RequestingMemberId = adminId,
            TargetMemberId = targetId,
            Role = "Club Admin"
        });

        Assert.Equal(UpdateMemberRoleStatus.NotFound, outcome.Status);
        Assert.Equal("Club not found.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_RequestingUserIsNotAdmin_ReturnsForbidden()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var targetId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Test Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateMemberRoleCommand
        {
            ClubId = clubId,
            RequestingMemberId = memberId,
            TargetMemberId = targetId,
            Role = "Club Admin"
        });

        Assert.Equal(UpdateMemberRoleStatus.Forbidden, outcome.Status);
        Assert.Equal("Only club administrators can modify member roles.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_TargetMemberNotInClub_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Test Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, adminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _clubRepoMock
            .Setup(r => r.UpdateMemberRoleAsync(clubId, targetId, "Club Admin", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateMemberRoleCommand
        {
            ClubId = clubId,
            RequestingMemberId = adminId,
            TargetMemberId = targetId,
            Role = "Club Admin"
        });

        Assert.Equal(UpdateMemberRoleStatus.NotFound, outcome.Status);
        Assert.Equal("Target member not found in this club.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_ValidAdminPromotion_ReturnsSuccess()
    {
        var clubId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var expectedDetail = new ClubMemberDetail(
            targetId,
            "Bob Student",
            "bob@example.com",
            "Club Admin",
            DateTimeOffset.UtcNow);

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Robotics Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, adminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _clubRepoMock
            .Setup(r => r.UpdateMemberRoleAsync(clubId, targetId, "Club Admin", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, targetId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedDetail);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateMemberRoleCommand
        {
            ClubId = clubId,
            RequestingMemberId = adminId,
            TargetMemberId = targetId,
            Role = "Club Admin"
        });

        Assert.Equal(UpdateMemberRoleStatus.Success, outcome.Status);
        Assert.NotNull(outcome.Member);
        Assert.Equal(targetId, outcome.Member.MemberId);
        Assert.Equal("Club Admin", outcome.Member.Role);
        Assert.Equal("Bob Student", outcome.Member.DisplayName);
    }
}
