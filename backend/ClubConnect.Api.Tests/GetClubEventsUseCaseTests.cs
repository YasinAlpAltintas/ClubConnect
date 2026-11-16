using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class GetClubEventsUseCaseTests
{
    private readonly Mock<IClubRepository> _clubRepoMock = new();

    private GetClubEventsUseCase CreateUseCase() => new(_clubRepoMock.Object);

    [Fact]
    public async Task ExecuteAsync_NullQuery_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(null!);

        Assert.Equal(GetClubEventsStatus.InvalidInput, outcome.Status);
        Assert.Equal("Query cannot be null.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyClubId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubEventsQuery
        {
            ClubId = Guid.Empty,
            RequestingMemberId = Guid.NewGuid()
        });

        Assert.Equal(GetClubEventsStatus.InvalidInput, outcome.Status);
        Assert.Equal("Club ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyRequestingMemberId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubEventsQuery
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = Guid.Empty
        });

        Assert.Equal(GetClubEventsStatus.InvalidInput, outcome.Status);
        Assert.Equal("Requesting member ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    [InlineData(-1)]
    public async Task ExecuteAsync_InvalidMonth_ReturnsInvalidInput(int month)
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubEventsQuery
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = Guid.NewGuid(),
            Year = 2026,
            Month = month
        });

        Assert.Equal(GetClubEventsStatus.InvalidInput, outcome.Status);
        Assert.Equal("Month must be between 1 and 12.", outcome.Violation);
    }

    [Theory]
    [InlineData(1999)]
    [InlineData(2101)]
    public async Task ExecuteAsync_InvalidYear_ReturnsInvalidInput(int year)
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubEventsQuery
        {
            ClubId = Guid.NewGuid(),
            RequestingMemberId = Guid.NewGuid(),
            Year = year,
            Month = 11
        });

        Assert.Equal(GetClubEventsStatus.InvalidInput, outcome.Status);
        Assert.Equal("Year must be between 2000 and 2100.", outcome.Violation);
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
        var outcome = await useCase.ExecuteAsync(new GetClubEventsQuery
        {
            ClubId = clubId,
            RequestingMemberId = memberId
        });

        Assert.Equal(GetClubEventsStatus.NotFound, outcome.Status);
        Assert.Equal("Club not found.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_RequestingUserIsNotMember_ReturnsForbidden()
    {
        var clubId = Guid.NewGuid();
        var strangerId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Chess Club" });

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, strangerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ClubMemberDetail?)null);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubEventsQuery
        {
            ClubId = clubId,
            RequestingMemberId = strangerId
        });

        Assert.Equal(GetClubEventsStatus.Forbidden, outcome.Status);
        Assert.Equal("You do not have access to this club workspace.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_AuthorizedMember_ReturnsEventsForClub()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Chess Club" });

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubMemberDetail(memberId, "Alice", "alice@chess.org", "Club Member", DateTimeOffset.UtcNow));

        var expectedEvents = new List<ClubEvent>
        {
            new()
            {
                Id = Guid.NewGuid(),
                ClubId = clubId,
                Title = "Annual Blitz Tournament",
                Description = "5-minute blitz chess tournament",
                Location = "Room 301",
                StartTimeUtc = new DateTimeOffset(2026, 11, 20, 18, 0, 0, TimeSpan.Zero),
                EndTimeUtc = new DateTimeOffset(2026, 11, 20, 21, 0, 0, TimeSpan.Zero),
                CreatedByMemberId = memberId,
                CreatedAtUtc = DateTimeOffset.UtcNow
            }
        };

        _clubRepoMock
            .Setup(r => r.GetEventsForClubAsync(clubId, It.IsAny<DateTimeOffset?>(), It.IsAny<DateTimeOffset?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedEvents);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubEventsQuery
        {
            ClubId = clubId,
            RequestingMemberId = memberId,
            Year = 2026,
            Month = 11
        });

        Assert.Equal(GetClubEventsStatus.Success, outcome.Status);
        Assert.Single(outcome.Events);
        Assert.Equal("Annual Blitz Tournament", outcome.Events[0].Title);
        Assert.Equal("Room 301", outcome.Events[0].Location);
    }

    [Fact]
    public async Task ExecuteAsync_WithYearAndMonth_CalculatesMonthBoundariesCorrectly()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Tech Society" });

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubMemberDetail(memberId, "Bob", "bob@tech.org", "Club Admin", DateTimeOffset.UtcNow));

        DateTimeOffset? capturedFrom = null;
        DateTimeOffset? capturedTo = null;

        _clubRepoMock
            .Setup(r => r.GetEventsForClubAsync(clubId, It.IsAny<DateTimeOffset?>(), It.IsAny<DateTimeOffset?>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, DateTimeOffset?, DateTimeOffset?, CancellationToken>((_, from, to, _) =>
            {
                capturedFrom = from;
                capturedTo = to;
            })
            .ReturnsAsync(new List<ClubEvent>());

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new GetClubEventsQuery
        {
            ClubId = clubId,
            RequestingMemberId = memberId,
            Year = 2026,
            Month = 2 // February 2026 (28 days)
        });

        Assert.Equal(GetClubEventsStatus.Success, outcome.Status);
        Assert.NotNull(capturedFrom);
        Assert.NotNull(capturedTo);
        Assert.Equal(new DateTimeOffset(2026, 2, 1, 0, 0, 0, TimeSpan.Zero), capturedFrom.Value);
        Assert.Equal(new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero).AddTicks(-1), capturedTo.Value);
    }
}
