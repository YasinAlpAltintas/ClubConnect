using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Use case for retrieving the Kanban board tasks of a club workspace (INC-27).
/// Enforces multi-tenant isolation: only members of the requested club can view its tasks.
/// </summary>
public class GetClubTasksUseCase(IClubRepository clubRepository)
{
    public async Task<GetClubTasksOutcome> ExecuteAsync(
        GetClubTasksQuery query,
        CancellationToken cancellationToken = default)
    {
        if (query is null)
        {
            return GetClubTasksOutcome.InvalidInput("Query cannot be null.");
        }

        if (query.ClubId == Guid.Empty)
        {
            return GetClubTasksOutcome.InvalidInput("Club ID must be a valid non-empty GUID.");
        }

        if (query.RequestingMemberId == Guid.Empty)
        {
            return GetClubTasksOutcome.InvalidInput("Requesting member ID must be a valid non-empty GUID.");
        }

        var club = await clubRepository.GetByIdAsync(query.ClubId, cancellationToken).ConfigureAwait(false);
        if (club is null)
        {
            return GetClubTasksOutcome.NotFound("Club not found.");
        }

        var member = await clubRepository.GetClubMemberAsync(query.ClubId, query.RequestingMemberId, cancellationToken).ConfigureAwait(false);
        if (member is null)
        {
            return GetClubTasksOutcome.Forbidden("You do not have access to this club workspace.");
        }

        var tasks = await clubRepository.GetTasksForClubAsync(query.ClubId, cancellationToken).ConfigureAwait(false);

        return GetClubTasksOutcome.Success(tasks);
    }
}
