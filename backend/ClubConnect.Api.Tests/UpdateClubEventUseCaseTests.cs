using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class UpdateClubEventUseCaseTests
{
    private readonly Mock<IClubRepository> _clubRepoMock = new();

    private UpdateClubEventUseCase CreateUseCase() => new(_clubRepoMock.Object);

    [Fact]
    public async Task ExecuteAsync_NullCommand_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(null!);

        Assert.Equal(UpdateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Command cannot be null.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyClubId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: Guid.Empty,
            EventId: Guid.NewGuid(),
            AdminMemberId: Guid.NewGuid(),
            Title: "Workshop",
            Description: null,
            Location: null,
            StartTimeUtc: DateTimeOffset.UtcNow,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Club ID must be a valid non-empty GUID.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyEventId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: Guid.NewGuid(),
            EventId: Guid.Empty,
            AdminMemberId: Guid.NewGuid(),
            Title: "Workshop",
            Description: null,
            Location: null,
            StartTimeUtc: DateTimeOffset.UtcNow,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event ID must be a valid non-empty GUID.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyAdminMemberId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: Guid.NewGuid(),
            EventId: Guid.NewGuid(),
            AdminMemberId: Guid.Empty,
            Title: "Workshop",
            Description: null,
            Location: null,
            StartTimeUtc: DateTimeOffset.UtcNow,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Admin member ID must be a valid non-empty GUID.", outcome.ErrorMessage);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ExecuteAsync_InvalidTitle_ReturnsInvalidInput(string? invalidTitle)
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: Guid.NewGuid(),
            EventId: Guid.NewGuid(),
            AdminMemberId: Guid.NewGuid(),
            Title: invalidTitle!,
            Description: null,
            Location: null,
            StartTimeUtc: DateTimeOffset.UtcNow,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event title is required.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_TitleTooLong_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: Guid.NewGuid(),
            EventId: Guid.NewGuid(),
            AdminMemberId: Guid.NewGuid(),
            Title: new string('A', 101),
            Description: null,
            Location: null,
            StartTimeUtc: DateTimeOffset.UtcNow,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event title cannot exceed 100 characters.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_DescriptionTooLong_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: Guid.NewGuid(),
            EventId: Guid.NewGuid(),
            AdminMemberId: Guid.NewGuid(),
            Title: "Workshop",
            Description: new string('D', 1001),
            Location: null,
            StartTimeUtc: DateTimeOffset.UtcNow,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event description cannot exceed 1000 characters.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_LocationTooLong_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: Guid.NewGuid(),
            EventId: Guid.NewGuid(),
            AdminMemberId: Guid.NewGuid(),
            Title: "Workshop",
            Description: "Valid desc",
            Location: new string('L', 201),
            StartTimeUtc: DateTimeOffset.UtcNow,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event location cannot exceed 200 characters.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_DefaultTimestamps_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: Guid.NewGuid(),
            EventId: Guid.NewGuid(),
            AdminMemberId: Guid.NewGuid(),
            Title: "Workshop",
            Description: null,
            Location: null,
            StartTimeUtc: default,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Start and end times must be valid non-default timestamps.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_EndTimeBeforeStartTime_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var now = DateTimeOffset.UtcNow;
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: Guid.NewGuid(),
            EventId: Guid.NewGuid(),
            AdminMemberId: Guid.NewGuid(),
            Title: "Workshop",
            Description: null,
            Location: null,
            StartTimeUtc: now.AddHours(2),
            EndTimeUtc: now));

        Assert.Equal(UpdateClubEventStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event end time must be strictly after start time.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_ClubNotFound_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        _clubRepoMock.Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Club?)null);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: clubId,
            EventId: Guid.NewGuid(),
            AdminMemberId: Guid.NewGuid(),
            Title: "Workshop",
            Description: null,
            Location: null,
            StartTimeUtc: DateTimeOffset.UtcNow,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.NotFound, outcome.Status);
        Assert.Equal("Club not found.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_NonAdminRequester_ReturnsForbidden()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        _clubRepoMock.Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Coding Society" });

        _clubRepoMock.Setup(r => r.IsClubAdminAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: clubId,
            EventId: Guid.NewGuid(),
            AdminMemberId: memberId,
            Title: "Workshop",
            Description: null,
            Location: null,
            StartTimeUtc: DateTimeOffset.UtcNow,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.Forbidden, outcome.Status);
        Assert.Equal("Only Club Admins can update club events.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_EventNotFound_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var adminId = Guid.NewGuid();

        _clubRepoMock.Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Coding Society" });

        _clubRepoMock.Setup(r => r.IsClubAdminAsync(clubId, adminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _clubRepoMock.Setup(r => r.GetEventByIdAsync(clubId, eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ClubEvent?)null);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: clubId,
            EventId: eventId,
            AdminMemberId: adminId,
            Title: "Workshop",
            Description: null,
            Location: null,
            StartTimeUtc: DateTimeOffset.UtcNow,
            EndTimeUtc: DateTimeOffset.UtcNow.AddHours(2)));

        Assert.Equal(UpdateClubEventStatus.NotFound, outcome.Status);
        Assert.Equal("Event not found.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_ValidAdminCommand_UpdatesEventAndReturnsSuccess()
    {
        var clubId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var existingEvent = new ClubEvent
        {
            Id = eventId,
            ClubId = clubId,
            Title = "Old Title",
            Description = "Old Desc",
            Location = "Old Room",
            StartTimeUtc = DateTimeOffset.UtcNow,
            EndTimeUtc = DateTimeOffset.UtcNow.AddHours(1),
            CreatedByMemberId = adminId
        };

        _clubRepoMock.Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Coding Society" });

        _clubRepoMock.Setup(r => r.IsClubAdminAsync(clubId, adminId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _clubRepoMock.Setup(r => r.GetEventByIdAsync(clubId, eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingEvent);

        _clubRepoMock.Setup(r => r.UpdateEventAsync(It.IsAny<ClubEvent>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ClubEvent evt, CancellationToken _) => evt);

        var useCase = CreateUseCase();
        var newStart = DateTimeOffset.UtcNow.AddDays(1);
        var newEnd = newStart.AddHours(3);

        var outcome = await useCase.ExecuteAsync(new UpdateClubEventCommand(
            ClubId: clubId,
            EventId: eventId,
            AdminMemberId: adminId,
            Title: "  New Workshop Title  ",
            Description: "  Updated Agenda  ",
            Location: "  Auditorium West  ",
            StartTimeUtc: newStart,
            EndTimeUtc: newEnd));

        Assert.Equal(UpdateClubEventStatus.Success, outcome.Status);
        Assert.NotNull(outcome.Event);
        Assert.Equal("New Workshop Title", outcome.Event.Title);
        Assert.Equal("Updated Agenda", outcome.Event.Description);
        Assert.Equal("Auditorium West", outcome.Event.Location);
        Assert.Equal(newStart, outcome.Event.StartTimeUtc);
        Assert.Equal(newEnd, outcome.Event.EndTimeUtc);
    }
}
