using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class GetClubMembersUseCaseTests
{
    private readonly Mock<IClubRepository> _clubRepoMock = new();

    private GetClubMembersUseCase CreateUseCase() => new(_clubRepoMock.Object);

    [Fact]
    public async Task ExecuteAsync_NullQuery_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(null!);

        Assert.Equal(GetClubMembersStatus.InvalidInput, outcome.Status);
        Assert.Equal("Query cannot be null.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyClubId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubMembersQuery
        {
            ClubId = Guid.Empty,
            RequestingMemberId = Guid.NewGuid()
        });

        Assert.Equal(GetClubMembersStatus.InvalidInput, outcome.Status);
        Assert.Equal("Club ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyRequestingMemberId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubMembersQuery
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = Guid.Empty
        });

        Assert.Equal(GetClubMembersStatus.InvalidInput, outcome.Status);
        Assert.Equal("Requesting member ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_ClubDoesNotExist_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Club?)null);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubMembersQuery
        {
            ClubId = clubId,
            RequestingMemberId = memberId
        });

        Assert.Equal(GetClubMembersStatus.NotFound, outcome.Status);
        Assert.Equal("Club not found.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_RequestingUserNotAdmin_ReturnsForbidden()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Chess Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubMembersQuery
        {
            ClubId = clubId,
            RequestingMemberId = memberId
        });

        Assert.Equal(GetClubMembersStatus.Forbidden, outcome.Status);
        Assert.Equal("Only club administrators can access the member overview.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_RequestingUserIsAdmin_ReturnsSuccessWithMembers()
    {
        var clubId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var member2Id = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Robotics Society" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, adminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var expectedMembers = new List<ClubMemberDetail>
        {
            new(adminId, "Admin User", "admin@example.com", "Club Admin", DateTimeOffset.UtcNow.AddDays(-10)),
            new(member2Id, "Member Two", "two@example.com", "Club Member", DateTimeOffset.UtcNow.AddDays(-2))
        };

        _clubRepoMock
            .Setup(r => r.GetMembersForClubAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedMembers);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubMembersQuery
        {
            ClubId = clubId,
            RequestingMemberId = adminId
        });

        Assert.Equal(GetClubMembersStatus.Success, outcome.Status);
        Assert.Equal(2, outcome.Members.Count);
        Assert.Equal("Admin User", outcome.Members[0].DisplayName);
        Assert.Equal("Club Admin", outcome.Members[0].Role);
        Assert.Equal("Member Two", outcome.Members[1].DisplayName);
        Assert.Equal("Club Member", outcome.Members[1].Role);
    }
}
