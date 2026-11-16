using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class RemoveClubMemberUseCaseTests
{
    private readonly Mock<IClubRepository> _clubRepoMock = new();

    private RemoveClubMemberUseCase CreateUseCase() => new(_clubRepoMock.Object);

    [Fact]
    public async Task ExecuteAsync_NullCommand_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(null!);

        Assert.Equal(RemoveClubMemberStatus.InvalidInput, outcome.Status);
        Assert.Equal("Command cannot be null.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyClubId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new RemoveClubMemberCommand
        {
            ClubId = Guid.Empty,
            RequestingMemberId = Guid.NewGuid(),
            TargetMemberId = Guid.NewGuid()
        });

        Assert.Equal(RemoveClubMemberStatus.InvalidInput, outcome.Status);
        Assert.Equal("Club ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyRequestingMemberId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new RemoveClubMemberCommand
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = Guid.Empty,
            TargetMemberId = Guid.NewGuid()
        });

        Assert.Equal(RemoveClubMemberStatus.InvalidInput, outcome.Status);
        Assert.Equal("Requesting member ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyTargetMemberId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new RemoveClubMemberCommand
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = Guid.NewGuid(),
            TargetMemberId = Guid.Empty
        });

        Assert.Equal(RemoveClubMemberStatus.InvalidInput, outcome.Status);
        Assert.Equal("Target member ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_SelfRemoval_ReturnsInvalidInput()
    {
        var sameMemberId = Guid.NewGuid();
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new RemoveClubMemberCommand
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = sameMemberId,
            TargetMemberId = sameMemberId
        });

        Assert.Equal(RemoveClubMemberStatus.InvalidInput, outcome.Status);
        Assert.Equal("Club administrators cannot remove themselves from the member roster.", outcome.Violation);
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
        var outcome = await useCase.ExecuteAsync(new RemoveClubMemberCommand
        {
            ClubId = clubId,
            RequestingMemberId = adminId,
            TargetMemberId = targetId
        });

        Assert.Equal(RemoveClubMemberStatus.NotFound, outcome.Status);
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
            .ReturnsAsync(new Club { Id = clubId, Name = "Chess Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new RemoveClubMemberCommand
        {
            ClubId = clubId,
            RequestingMemberId = memberId,
            TargetMemberId = targetId
        });

        Assert.Equal(RemoveClubMemberStatus.Forbidden, outcome.Status);
        Assert.Equal("Only club administrators can remove members from the club.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_TargetMemberNotInClub_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Chess Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, adminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, targetId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ClubMemberDetail?)null);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new RemoveClubMemberCommand
        {
            ClubId = clubId,
            RequestingMemberId = adminId,
            TargetMemberId = targetId
        });

        Assert.Equal(RemoveClubMemberStatus.NotFound, outcome.Status);
        Assert.Equal("Target member not found in this club.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_CannotRemoveSoleAdmin_ReturnsInvalidInput()
    {
        var clubId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var targetAdminId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Chess Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, adminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, targetAdminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubMemberDetail(targetAdminId, "Target Admin", "admin@chess.org", "Club Admin", DateTimeOffset.UtcNow));

        _clubRepoMock
            .Setup(r => r.GetAdminCountForClubAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new RemoveClubMemberCommand
        {
            ClubId = clubId,
            RequestingMemberId = adminId,
            TargetMemberId = targetAdminId
        });

        Assert.Equal(RemoveClubMemberStatus.InvalidInput, outcome.Status);
        Assert.Equal("Cannot remove the only club administrator. Assign another administrator first.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_CanRemoveAdminWhenMultipleAdminsExist_ReturnsSuccess()
    {
        var clubId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var targetAdminId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Chess Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, adminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, targetAdminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubMemberDetail(targetAdminId, "Target Admin", "admin@chess.org", "Club Admin", DateTimeOffset.UtcNow));

        _clubRepoMock
            .Setup(r => r.GetAdminCountForClubAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        _clubRepoMock
            .Setup(r => r.RemoveMemberAsync(clubId, targetAdminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new RemoveClubMemberCommand
        {
            ClubId = clubId,
            RequestingMemberId = adminId,
            TargetMemberId = targetAdminId
        });

        Assert.Equal(RemoveClubMemberStatus.Success, outcome.Status);
    }

    [Fact]
    public async Task ExecuteAsync_ValidMemberRemoval_ReturnsSuccess()
    {
        var clubId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var targetMemberId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Chess Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, adminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, targetMemberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubMemberDetail(targetMemberId, "Bob Member", "bob@example.com", "Club Member", DateTimeOffset.UtcNow));

        _clubRepoMock
            .Setup(r => r.RemoveMemberAsync(clubId, targetMemberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new RemoveClubMemberCommand
        {
            ClubId = clubId,
            RequestingMemberId = adminId,
            TargetMemberId = targetMemberId
        });

        Assert.Equal(RemoveClubMemberStatus.Success, outcome.Status);
    }
}
