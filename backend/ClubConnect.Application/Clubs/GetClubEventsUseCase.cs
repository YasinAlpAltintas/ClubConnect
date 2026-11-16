using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Use case for retrieving scheduled events for a club workspace (INC-23).
/// Enforces multi-tenant isolation: only members of the requested club can view its calendar events.
/// </summary>
public class GetClubEventsUseCase(IClubRepository clubRepository)
{
    public async Task<GetClubEventsOutcome> ExecuteAsync(
        GetClubEventsQuery query,
        CancellationToken cancellationToken = default)
    {
        if (query is null)
        {
            return GetClubEventsOutcome.InvalidInput("Query cannot be null.");
        }

        if (query.ClubId == Guid.Empty)
        {
            return GetClubEventsOutcome.InvalidInput("Club ID must be a valid non-empty GUID.");
        }

        if (query.RequestingMemberId == Guid.Empty)
        {
            return GetClubEventsOutcome.InvalidInput("Requesting member ID must be a valid non-empty GUID.");
        }

        if (query.Month.HasValue && (query.Month.Value < 1 || query.Month.Value > 12))
        {
            return GetClubEventsOutcome.InvalidInput("Month must be between 1 and 12.");
        }

        if (query.Year.HasValue && (query.Year.Value < 2000 || query.Year.Value > 2100))
        {
            return GetClubEventsOutcome.InvalidInput("Year must be between 2000 and 2100.");
        }

        var club = await clubRepository.GetByIdAsync(query.ClubId, cancellationToken).ConfigureAwait(false);
        if (club is null)
        {
            return GetClubEventsOutcome.NotFound("Club not found.");
        }

        var member = await clubRepository.GetClubMemberAsync(query.ClubId, query.RequestingMemberId, cancellationToken).ConfigureAwait(false);
        if (member is null)
        {
            return GetClubEventsOutcome.Forbidden("You do not have access to this club workspace.");
        }

        DateTimeOffset? fromUtc = query.FromUtc;
        DateTimeOffset? toUtc = query.ToUtc;

        if (query.Year.HasValue && query.Month.HasValue)
        {
            var startOfMonth = new DateTimeOffset(query.Year.Value, query.Month.Value, 1, 0, 0, 0, TimeSpan.Zero);
            var endOfMonth = startOfMonth.AddMonths(1).AddTicks(-1);
            fromUtc ??= startOfMonth;
            toUtc ??= endOfMonth;
        }

        var events = await clubRepository.GetEventsForClubAsync(
            query.ClubId,
            fromUtc,
            toUtc,
            cancellationToken).ConfigureAwait(false);

        return GetClubEventsOutcome.Success(events);
    }
}
