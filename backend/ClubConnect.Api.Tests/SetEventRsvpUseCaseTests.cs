using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class SetEventRsvpUseCaseTests
{
    private readonly Mock<IClubRepository> _clubRepoMock = new();

    private SetEventRsvpUseCase CreateUseCase() => new(_clubRepoMock.Object);

    [Fact]
    public async Task ExecuteAsync_NullCommand_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(null!);

        Assert.Equal(SetEventRsvpStatus.InvalidInput, outcome.Status);
        Assert.Equal("Command cannot be null.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyClubId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new SetEventRsvpCommand(
            ClubId: Guid.Empty,
            EventId: Guid.NewGuid(),
            MemberId: Guid.NewGuid(),
            IsAttending: true));

        Assert.Equal(SetEventRsvpStatus.InvalidInput, outcome.Status);
        Assert.Equal("Club ID must be a valid non-empty GUID.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyEventId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new SetEventRsvpCommand(
            ClubId: Guid.NewGuid(),
            EventId: Guid.Empty,
            MemberId: Guid.NewGuid(),
            IsAttending: true));

        Assert.Equal(SetEventRsvpStatus.InvalidInput, outcome.Status);
        Assert.Equal("Event ID must be a valid non-empty GUID.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_EmptyMemberId_ReturnsInvalidInput()
    {
        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new SetEventRsvpCommand(
            ClubId: Guid.NewGuid(),
            EventId: Guid.NewGuid(),
            MemberId: Guid.Empty,
            IsAttending: true));

        Assert.Equal(SetEventRsvpStatus.InvalidInput, outcome.Status);
        Assert.Equal("Member ID must be a valid non-empty GUID.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_ClubNotFound_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Club?)null);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new SetEventRsvpCommand(
            ClubId: clubId,
            EventId: Guid.NewGuid(),
            MemberId: Guid.NewGuid(),
            IsAttending: true));

        Assert.Equal(SetEventRsvpStatus.NotFound, outcome.Status);
        Assert.Equal("Club not found.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_MemberNotPartOfClub_ReturnsForbidden()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Coding Club" });

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ClubMemberDetail?)null);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new SetEventRsvpCommand(
            ClubId: clubId,
            EventId: Guid.NewGuid(),
            MemberId: memberId,
            IsAttending: true));

        Assert.Equal(SetEventRsvpStatus.Forbidden, outcome.Status);
        Assert.Equal("Only active members of this club can RSVP to events.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_EventNotFound_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Coding Club" });

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubMemberDetail(memberId, "Alex", "alex@example.com", "Club Member", DateTimeOffset.UtcNow));

        _clubRepoMock
            .Setup(r => r.GetEventByIdAsync(clubId, eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ClubEvent?)null);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new SetEventRsvpCommand(
            ClubId: clubId,
            EventId: eventId,
            MemberId: memberId,
            IsAttending: true));

        Assert.Equal(SetEventRsvpStatus.NotFound, outcome.Status);
        Assert.Equal("Event not found.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_EventBelongsToDifferentClub_ReturnsNotFound()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Coding Club" });

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubMemberDetail(memberId, "Alex", "alex@example.com", "Club Member", DateTimeOffset.UtcNow));

        _clubRepoMock
            .Setup(r => r.GetEventByIdAsync(clubId, eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubEvent
            {
                Id = eventId,
                ClubId = Guid.NewGuid(), // different club!
                Title = "Wrong Club Event"
            });

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new SetEventRsvpCommand(
            ClubId: clubId,
            EventId: eventId,
            MemberId: memberId,
            IsAttending: true));

        Assert.Equal(SetEventRsvpStatus.NotFound, outcome.Status);
        Assert.Equal("Event not found.", outcome.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_ValidAttending_CallsRepository_ReturnsSuccess()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Coding Club" });

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubMemberDetail(memberId, "Alex", "alex@example.com", "Club Member", DateTimeOffset.UtcNow));

        var clubEvent = new ClubEvent
        {
            Id = eventId,
            ClubId = clubId,
            Title = "Game Jam",
            StartTimeUtc = DateTimeOffset.UtcNow.AddDays(1),
            EndTimeUtc = DateTimeOffset.UtcNow.AddDays(1).AddHours(2)
        };

        _clubRepoMock
            .Setup(r => r.GetEventByIdAsync(clubId, eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(clubEvent);

        var attendee = new ClubEventAttendee { EventId = eventId, MemberId = memberId };
        clubEvent.Attendees.Add(attendee);

        _clubRepoMock
            .Setup(r => r.SetEventRsvpAsync(clubId, eventId, memberId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(clubEvent);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new SetEventRsvpCommand(
            ClubId: clubId,
            EventId: eventId,
            MemberId: memberId,
            IsAttending: true));

        Assert.Equal(SetEventRsvpStatus.Success, outcome.Status);
        Assert.NotNull(outcome.Event);
        Assert.Single(outcome.Event.Attendees);
        _clubRepoMock.Verify(r => r.SetEventRsvpAsync(clubId, eventId, memberId, true, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_ValidCancelling_CallsRepository_ReturnsSuccess()
    {
        var clubId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();

        _clubRepoMock
            .Setup(r => r.GetByIdAsync(clubId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Club { Id = clubId, Name = "Coding Club" });

        _clubRepoMock
            .Setup(r => r.GetClubMemberAsync(clubId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClubMemberDetail(memberId, "Alex", "alex@example.com", "Club Member", DateTimeOffset.UtcNow));

        var clubEvent = new ClubEvent
        {
            Id = eventId,
            ClubId = clubId,
            Title = "Game Jam",
            StartTimeUtc = DateTimeOffset.UtcNow.AddDays(1),
            EndTimeUtc = DateTimeOffset.UtcNow.AddDays(1).AddHours(2)
        };

        _clubRepoMock
            .Setup(r => r.GetEventByIdAsync(clubId, eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(clubEvent);

        _clubRepoMock
            .Setup(r => r.SetEventRsvpAsync(clubId, eventId, memberId, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(clubEvent);

        var useCase = CreateUseCase();
        var outcome = await useCase.ExecuteAsync(new SetEventRsvpCommand(
            ClubId: clubId,
            EventId: eventId,
            MemberId: memberId,
            IsAttending: false));

        Assert.Equal(SetEventRsvpStatus.Success, outcome.Status);
        Assert.NotNull(outcome.Event);
        Assert.Empty(outcome.Event.Attendees);
        _clubRepoMock.Verify(r => r.SetEventRsvpAsync(clubId, eventId, memberId, false, It.IsAny<CancellationToken>()), Times.Once);
    }
}
