using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Use case for recording or cancelling a member's RSVP for a scheduled event (INC-26).
/// Enforces multi-tenant isolation: only active members of the club workspace can RSVP.
/// </summary>
public class SetEventRsvpUseCase(IClubRepository clubRepository)
{
    public async Task<SetEventRsvpOutcome> ExecuteAsync(
        SetEventRsvpCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command is null)
        {
            return SetEventRsvpOutcome.InvalidInput("Command cannot be null.");
        }

        if (command.ClubId == Guid.Empty)
        {
            return SetEventRsvpOutcome.InvalidInput("Club ID must be a valid non-empty GUID.");
        }

        if (command.EventId == Guid.Empty)
        {
            return SetEventRsvpOutcome.InvalidInput("Event ID must be a valid non-empty GUID.");
        }

        if (command.MemberId == Guid.Empty)
        {
            return SetEventRsvpOutcome.InvalidInput("Member ID must be a valid non-empty GUID.");
        }

        var club = await clubRepository.GetByIdAsync(command.ClubId, cancellationToken).ConfigureAwait(false);
        if (club is null)
        {
            return SetEventRsvpOutcome.NotFound("Club not found.");
        }

        var membership = await clubRepository.GetClubMemberAsync(command.ClubId, command.MemberId, cancellationToken).ConfigureAwait(false);
        if (membership is null)
        {
            return SetEventRsvpOutcome.Forbidden("Only active members of this club can RSVP to events.");
        }

        var existingEvent = await clubRepository.GetEventByIdAsync(command.ClubId, command.EventId, cancellationToken).ConfigureAwait(false);
        if (existingEvent is null || existingEvent.ClubId != command.ClubId)
        {
            return SetEventRsvpOutcome.NotFound("Event not found.");
        }

        var updated = await clubRepository.SetEventRsvpAsync(
            command.ClubId,
            command.EventId,
            command.MemberId,
            command.IsAttending,
            cancellationToken).ConfigureAwait(false);

        if (updated is null)
        {
            return SetEventRsvpOutcome.NotFound("Event not found.");
        }

        return SetEventRsvpOutcome.Success(updated);
    }
}
