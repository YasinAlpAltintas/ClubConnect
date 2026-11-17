using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Use case for scheduling a new club event (INC-24).
/// Enforces multi-tenant authorization: only active Club Admins can schedule activities.
/// Validates title, location, description lengths, and chronological time constraints.
/// </summary>
public class CreateClubEventUseCase(IClubRepository clubRepository)
{
    public async Task<CreateClubEventOutcome> ExecuteAsync(
        CreateClubEventCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command is null)
        {
            return CreateClubEventOutcome.InvalidInput("Command cannot be null.");
        }

        if (command.ClubId == Guid.Empty)
        {
            return CreateClubEventOutcome.InvalidInput("Club ID must be a valid non-empty GUID.");
        }

        if (command.AdminMemberId == Guid.Empty)
        {
            return CreateClubEventOutcome.InvalidInput("Admin member ID must be a valid non-empty GUID.");
        }

        if (string.IsNullOrWhiteSpace(command.Title))
        {
            return CreateClubEventOutcome.InvalidInput("Event title is required.");
        }

        var trimmedTitle = command.Title.Trim();
        if (trimmedTitle.Length > 100)
        {
            return CreateClubEventOutcome.InvalidInput("Event title cannot exceed 100 characters.");
        }

        if (command.Description is not null && command.Description.Length > 1000)
        {
            return CreateClubEventOutcome.InvalidInput("Event description cannot exceed 1000 characters.");
        }

        if (command.Location is not null && command.Location.Length > 200)
        {
            return CreateClubEventOutcome.InvalidInput("Event location cannot exceed 200 characters.");
        }

        if (command.StartTimeUtc == default || command.EndTimeUtc == default)
        {
            return CreateClubEventOutcome.InvalidInput("Start and end times must be valid non-default timestamps.");
        }

        if (command.EndTimeUtc <= command.StartTimeUtc)
        {
            return CreateClubEventOutcome.InvalidInput("Event end time must be strictly after start time.");
        }

        var club = await clubRepository.GetByIdAsync(command.ClubId, cancellationToken).ConfigureAwait(false);
        if (club is null)
        {
            return CreateClubEventOutcome.NotFound("Club not found.");
        }

        var isAdmin = await clubRepository.IsClubAdminAsync(command.ClubId, command.AdminMemberId, cancellationToken).ConfigureAwait(false);
        if (!isAdmin)
        {
            return CreateClubEventOutcome.Forbidden("Only Club Admins can schedule club events.");
        }

        var clubEvent = new ClubEvent
        {
            Id = Guid.NewGuid(),
            ClubId = command.ClubId,
            Title = trimmedTitle,
            Description = string.IsNullOrWhiteSpace(command.Description) ? null : command.Description.Trim(),
            Location = string.IsNullOrWhiteSpace(command.Location) ? null : command.Location.Trim(),
            StartTimeUtc = command.StartTimeUtc,
            EndTimeUtc = command.EndTimeUtc,
            CreatedByMemberId = command.AdminMemberId,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        var created = await clubRepository.CreateEventAsync(clubEvent, cancellationToken).ConfigureAwait(false);
        return CreateClubEventOutcome.Success(created);
    }
}
