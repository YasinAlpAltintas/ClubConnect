using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Use case for retrieving members of a club workspace.
/// Enforces tenant isolation: only authenticated Club Admins of the requested club can view its members.
/// </summary>
public class GetClubMembersUseCase(IClubRepository clubRepository)
{
    public async Task<GetClubMembersOutcome> ExecuteAsync(
        GetClubMembersQuery query,
        CancellationToken cancellationToken = default)
    {
        if (query is null)
        {
            return GetClubMembersOutcome.InvalidInput("Query cannot be null.");
        }

        if (query.ClubId == Guid.Empty)
        {
            return GetClubMembersOutcome.InvalidInput("Club ID must be a valid non-empty GUID.");
        }

        if (query.RequestingMemberId == Guid.Empty)
        {
            return GetClubMembersOutcome.InvalidInput("Requesting member ID must be a valid non-empty GUID.");
        }

        var club = await clubRepository.GetByIdAsync(query.ClubId, cancellationToken).ConfigureAwait(false);
        if (club is null)
        {
            return GetClubMembersOutcome.NotFound("Club not found.");
        }

        var isAdmin = await clubRepository.IsClubAdminAsync(query.ClubId, query.RequestingMemberId, cancellationToken).ConfigureAwait(false);
        if (!isAdmin)
        {
            return GetClubMembersOutcome.Forbidden("Only club administrators can access the member overview.");
        }

        var members = await clubRepository.GetMembersForClubAsync(query.ClubId, cancellationToken).ConfigureAwait(false);
        return GetClubMembersOutcome.Success(members);
    }
}
