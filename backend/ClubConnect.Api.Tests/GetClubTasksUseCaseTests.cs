using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class GetClubTasksUseCaseTests
{
    private readonly Mock<IClubRepository> _clubRepoMock = new();

    private GetClubTasksUseCase CreateUseCase() => new(_clubRepoMock.Object);

    [Fact]
    public async Task ExecuteAsync_NullQuery_ReturnsInvalidInput()
    {
        var outcome = await CreateUseCase().ExecuteAsync(null!);

        Assert.Equal(GetClubTasksStatus.InvalidInput, outcome.Status);
        Assert.Equal("Query cannot be null.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyClubId_ReturnsInvalidInput()
    {
        var outcome = await CreateUseCase().ExecuteAsync(new GetClubTasksQuery
        {
            ClubId = Guid.Empty,
            RequestingMemberId = Guid.NewGuid()
        });

        Assert.Equal(GetClubTasksStatus.InvalidInput, outcome.Status);
        Assert.Equal("Club ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyRequestingMemberId_ReturnsInvalidInput()
    {
        var outcome = await CreateUseCase().ExecuteAsync(new GetClubTasksQuery
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = Guid.Empty
        });

        Assert.Equal(GetClubTasksStatus.InvalidInput, outcome.Status);
        Assert.Equal("Requesting member ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_ClubDoesNotExist_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Club?)null);

        var outcome = await CreateUseCase().ExecuteAsync(new GetClubTasksQuery
        {
            ClubId = clubId,
            RequestingMemberId = Guid.NewGuid()
        });

        Assert.Equal(GetClubTasksStatus.NotFound, outcome.Status);
        _clubRepoMock.Verify(r => r.GetTasksForClubAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_RequesterNotMember_ReturnsForbidden_WithoutLoadingTasks()
    {
        var clubId = Guid.NewGuid();
        var strangerId = Guid.NewGuid();
        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Chess Club" });
        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, strangerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ClubMemberDetail?)null);

        var outcome = await CreateUseCase().ExecuteAsync(new GetClubTasksQuery
        {
            ClubId = clubId,
            RequestingMemberId = strangerId
        });

        Assert.Equal(GetClubTasksStatus.Forbidden, outcome.Status);
        Assert.Empty(outcome.Tasks);
        _clubRepoMock.Verify(r => r.GetTasksForClubAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_RequesterIsMember_ReturnsClubTasks()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Chess Club" });
        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubMemberDetail(memberId, "Alice", "alice@chess.org", "Club Member", DateTimeOffset.UtcNow));

        var expectedTasks = new List<ClubTask>
        {
            new() { ClubId = clubId, Title = "Book the hall", Status = ClubTaskStatus.ToDo },
            new() { ClubId = clubId, Title = "Order boards", Status = ClubTaskStatus.InProgress },
            new() { ClubId = clubId, Title = "Send newsletter", Status = ClubTaskStatus.Done }
        };
        _clubRepoMock
            .Setup(r => r.GetTasksForClubAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedTasks);

        var outcome = await CreateUseCase().ExecuteAsync(new GetClubTasksQuery
        {
            ClubId = clubId,
            RequestingMemberId = memberId
        });

        Assert.Equal(GetClubTasksStatus.Success, outcome.Status);
        Assert.Equal(expectedTasks, outcome.Tasks);
    }
}
