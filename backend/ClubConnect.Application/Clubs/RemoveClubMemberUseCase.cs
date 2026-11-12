using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Use case for removing a member from a club workspace, revoking all access.
/// Enforces strict admin authorization and prevents orphaning the club.
/// </summary>
public class RemoveClubMemberUseCase(IClubRepository clubRepository)
{
    public async Task<RemoveClubMemberOutcome> ExecuteAsync(
        RemoveClubMemberCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command is null)
        {
            return RemoveClubMemberOutcome.InvalidInput("Command cannot be null.");
        }

        if (command.ClubId == Guid.Empty)
        {
            return RemoveClubMemberOutcome.InvalidInput("Club ID must be a valid non-empty GUID.");
        }

        if (command.RequestingMemberId == Guid.Empty)
        {
            return RemoveClubMemberOutcome.InvalidInput("Requesting member ID must be a valid non-empty GUID.");
        }

        if (command.TargetMemberId == Guid.Empty)
        {
            return RemoveClubMemberOutcome.InvalidInput("Target member ID must be a valid non-empty GUID.");
        }

        if (command.RequestingMemberId == command.TargetMemberId)
        {
            return RemoveClubMemberOutcome.InvalidInput("Club administrators cannot remove themselves from the member roster.");
        }

        var club = await clubRepository.GetByIdAsync(command.ClubId, cancellationToken).ConfigureAwait(false);
        if (club is null)
        {
            return RemoveClubMemberOutcome.NotFound("Club not found.");
        }

        var isRequestingAdmin = await clubRepository.IsClubAdminAsync(
            command.ClubId,
            command.RequestingMemberId,
            cancellationToken).ConfigureAwait(false);

        if (!isRequestingAdmin)
        {
            return RemoveClubMemberOutcome.Forbidden("Only club administrators can remove members from the club.");
        }

        var targetMember = await clubRepository.GetClubMemberAsync(
            command.ClubId,
            command.TargetMemberId,
            cancellationToken).ConfigureAwait(false);

        if (targetMember is null)
        {
            return RemoveClubMemberOutcome.NotFound("Target member not found in this club.");
        }

        if (targetMember.Role == "Club Admin")
        {
            var adminCount = await clubRepository.GetAdminCountForClubAsync(command.ClubId, cancellationToken).ConfigureAwait(false);
            if (adminCount <= 1)
            {
                return RemoveClubMemberOutcome.InvalidInput("Cannot remove the only club administrator. Assign another administrator first.");
            }
        }

        var removed = await clubRepository.RemoveMemberAsync(
            command.ClubId,
            command.TargetMemberId,
            cancellationToken).ConfigureAwait(false);

        if (!removed)
        {
            return RemoveClubMemberOutcome.NotFound("Target member not found in this club.");
        }

        return RemoveClubMemberOutcome.Success();
    }
}
