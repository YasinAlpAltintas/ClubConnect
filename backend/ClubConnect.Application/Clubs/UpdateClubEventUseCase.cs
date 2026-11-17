using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Use case for updating and completing scheduled club event details (INC-25).
/// Enforces multi-tenant authorization: only active Club Admins can edit activities.
/// Validates title, location, description lengths, and chronological time constraints.
/// </summary>
public class UpdateClubEventUseCase(IClubRepository clubRepository)
{
    public async Task<UpdateClubEventOutcome> ExecuteAsync(
        UpdateClubEventCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command is null)
        {
            return UpdateClubEventOutcome.InvalidInput("Command cannot be null.");
        }

        if (command.ClubId == Guid.Empty)
        {
            return UpdateClubEventOutcome.InvalidInput("Club ID must be a valid non-empty GUID.");
        }

        if (command.EventId == Guid.Empty)
        {
            return UpdateClubEventOutcome.InvalidInput("Event ID must be a valid non-empty GUID.");
        }

        if (command.AdminMemberId == Guid.Empty)
        {
            return UpdateClubEventOutcome.InvalidInput("Admin member ID must be a valid non-empty GUID.");
        }

        if (string.IsNullOrWhiteSpace(command.Title))
        {
            return UpdateClubEventOutcome.InvalidInput("Event title is required.");
        }

        var trimmedTitle = command.Title.Trim();
        if (trimmedTitle.Length > 100)
        {
            return UpdateClubEventOutcome.InvalidInput("Event title cannot exceed 100 characters.");
        }

        if (command.Description is not null && command.Description.Length > 1000)
        {
            return UpdateClubEventOutcome.InvalidInput("Event description cannot exceed 1000 characters.");
        }

        if (command.Location is not null && command.Location.Length > 200)
        {
            return UpdateClubEventOutcome.InvalidInput("Event location cannot exceed 200 characters.");
        }

        if (command.StartTimeUtc == default || command.EndTimeUtc == default)
        {
            return UpdateClubEventOutcome.InvalidInput("Start and end times must be valid non-default timestamps.");
        }

        if (command.EndTimeUtc <= command.StartTimeUtc)
        {
            return UpdateClubEventOutcome.InvalidInput("Event end time must be strictly after start time.");
        }

        var club = await clubRepository.GetByIdAsync(command.ClubId, cancellationToken).ConfigureAwait(false);
        if (club is null)
        {
            return UpdateClubEventOutcome.NotFound("Club not found.");
        }

        var isAdmin = await clubRepository.IsClubAdminAsync(command.ClubId, command.AdminMemberId, cancellationToken).ConfigureAwait(false);
        if (!isAdmin)
        {
            return UpdateClubEventOutcome.Forbidden("Only Club Admins can update club events.");
        }

        var existingEvent = await clubRepository.GetEventByIdAsync(command.ClubId, command.EventId, cancellationToken).ConfigureAwait(false);
        if (existingEvent is null)
        {
            return UpdateClubEventOutcome.NotFound("Event not found.");
        }

        existingEvent.Title = trimmedTitle;
        existingEvent.Description = string.IsNullOrWhiteSpace(command.Description) ? null : command.Description.Trim();
        existingEvent.Location = string.IsNullOrWhiteSpace(command.Location) ? null : command.Location.Trim();
        existingEvent.StartTimeUtc = command.StartTimeUtc;
        existingEvent.EndTimeUtc = command.EndTimeUtc;

        var updated = await clubRepository.UpdateEventAsync(existingEvent, cancellationToken).ConfigureAwait(false);
        return UpdateClubEventOutcome.Success(updated!);
    }
}
