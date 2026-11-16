using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class CreateClubEventUseCaseTests
{
    private readonly Mock<IClubRepository> _clubRepoMock = new();

    private CreateClubEventUseCase CreateUseCase() => new(_clubRepoMock.Object);

    [Fact]
    public async Task ExecuteAsync_NullCommand_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(null!);

        Assert.Equal(CreateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Command cannot be null.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyClubId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = Guid.Empty,
            AdminMemberId = Guid.NewGuid(),
            Title = "Hackathon",
            StartTimeUtc = DateTimeOffset.UtcNow,
            EndTimeUtc = DateTimeOffset.UtcNow.AddHours(2)
        });

        Assert.Equal(CreateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Club ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyAdminMemberId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = Guid.NewGuid(),
            AdminMemberId = Guid.Empty,
            Title = "Hackathon",
            StartTimeUtc = DateTimeOffset.UtcNow,
            EndTimeUtc = DateTimeOffset.UtcNow.AddHours(2)
        });

        Assert.Equal(CreateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Admin member ID must be a valid non-empty GUID.", outcome.Violation);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ExecuteAsync_MissingTitle_ReturnsInvalidInput(string? title)
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = Guid.NewGuid(),
            AdminMemberId = Guid.NewGuid(),
            Title = title!,
            StartTimeUtc = DateTimeOffset.UtcNow,
            EndTimeUtc = DateTimeOffset.UtcNow.AddHours(2)
        });

        Assert.Equal(CreateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event title is required.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_TitleExceeds100Chars_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = Guid.NewGuid(),
            AdminMemberId = Guid.NewGuid(),
            Title = new string('A', 101),
            StartTimeUtc = DateTimeOffset.UtcNow,
            EndTimeUtc = DateTimeOffset.UtcNow.AddHours(2)
        });

        Assert.Equal(CreateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event title cannot exceed 100 characters.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_DescriptionExceeds1000Chars_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = Guid.NewGuid(),
            AdminMemberId = Guid.NewGuid(),
            Title = "Chess Tournament",
            Description = new string('D', 1001),
            StartTimeUtc = DateTimeOffset.UtcNow,
            EndTimeUtc = DateTimeOffset.UtcNow.AddHours(2)
        });

        Assert.Equal(CreateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event description cannot exceed 1000 characters.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_LocationExceeds200Chars_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = Guid.NewGuid(),
            AdminMemberId = Guid.NewGuid(),
            Title = "Chess Tournament",
            Location = new string('L', 201),
            StartTimeUtc = DateTimeOffset.UtcNow,
            EndTimeUtc = DateTimeOffset.UtcNow.AddHours(2)
        });

        Assert.Equal(CreateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event location cannot exceed 200 characters.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_DefaultTimes_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = Guid.NewGuid(),
            AdminMemberId = Guid.NewGuid(),
            Title = "Chess Tournament",
            StartTimeUtc = default,
            EndTimeUtc = default
        });

        Assert.Equal(CreateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Start and end times must be valid non-default timestamps.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_EndTimeBeforeOrEqualStartTime_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var now = DateTimeOffset.UtcNow;
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = Guid.NewGuid(),
            AdminMemberId = Guid.NewGuid(),
            Title = "Workshop",
            StartTimeUtc = now,
            EndTimeUtc = now
        });

        Assert.Equal(CreateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event end time must be strictly after start time.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_ClubNotFound_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        var adminId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Club?)null);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = clubId,
            AdminMemberId = adminId,
            Title = "Workshop",
            StartTimeUtc = DateTimeOffset.UtcNow,
            EndTimeUtc = DateTimeOffset.UtcNow.AddHours(1)
        });

        Assert.Equal(CreateClubEventStatus.NotFound, outcome.Status);
        Assert.Equal("Club not found.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_UserNotClubAdmin_ReturnsForbidden()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Coding Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = clubId,
            AdminMemberId = memberId,
            Title = "Workshop",
            StartTimeUtc = DateTimeOffset.UtcNow,
            EndTimeUtc = DateTimeOffset.UtcNow.AddHours(1)
        });

        Assert.Equal(CreateClubEventStatus.Forbidden, outcome.Status);
        Assert.Equal("Only Club Admins can schedule club events.", outcome.Violation);
    }

    [Fact]
    public async Task ExecuteAsync_ValidCommand_CreatesEventAndReturnsSuccess()
    {
        var clubId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var start = DateTimeOffset.UtcNow.AddDays(1);
        var end = start.AddHours(2);

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Coding Club" });

        _clubRepoMock
            .Setup(r => r.IsClubAdminAsync(clubId, adminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _clubRepoMock
            .Setup(r => r.CreateEventAsync(It.IsAny<ClubEvent>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ClubEvent e, CancellationToken _) => e);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new CreateClubEventCommand
        {
            ClubId = clubId,
            AdminMemberId = adminId,
            Title = "  Annual Coding Challenge  ",
            Description = "  Bring your laptops  ",
            Location = "  Room 101  ",
            StartTimeUtc = start,
            EndTimeUtc = end
        });

        Assert.Equal(CreateClubEventStatus.Success, outcome.Status);
        Assert.NotNull(outcome.Event);
        Assert.Equal("Annual Coding Challenge", outcome.Event.Title);
        Assert.Equal("Bring your laptops", outcome.Event.Description);
        Assert.Equal("Room 101", outcome.Event.Location);
        Assert.Equal(start, outcome.Event.StartTimeUtc);
        Assert.Equal(end, outcome.Event.EndTimeUtc);
        Assert.Equal(adminId, outcome.Event.CreatedByMemberId);
        Assert.Equal(clubId, outcome.Event.ClubId);

        _clubRepoMock.Verify(r => r.CreateEventAsync(
            It.Is<ClubEvent>(e => e.Title == "Annual Coding Challenge" && e.ClubId == clubId),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
