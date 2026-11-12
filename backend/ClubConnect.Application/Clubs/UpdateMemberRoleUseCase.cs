using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Use case for updating a member's role within a club workspace (e.g. promoting "Club Member" to "Club Admin").
/// Enforces strict admin authorization and validation rules.
/// </summary>
public class UpdateMemberRoleUseCase(IClubRepository clubRepository)
{
    public async Task<UpdateMemberRoleOutcome> ExecuteAsync(
        UpdateMemberRoleCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command is null)
        {
            return UpdateMemberRoleOutcome.InvalidInput("Command cannot be null.");
        }

        if (command.ClubId == Guid.Empty)
        {
            return UpdateMemberRoleOutcome.InvalidInput("Club ID must be a valid non-empty GUID.");
        }

        if (command.RequestingMemberId == Guid.Empty)
        {
            return UpdateMemberRoleOutcome.InvalidInput("Requesting member ID must be a valid non-empty GUID.");
        }

        if (command.TargetMemberId == Guid.Empty)
        {
            return UpdateMemberRoleOutcome.InvalidInput("Target member ID must be a valid non-empty GUID.");
        }

        if (string.IsNullOrWhiteSpace(command.Role) ||
            (command.Role != "Club Admin" && command.Role != "Club Member"))
        {
            return UpdateMemberRoleOutcome.InvalidInput("Role must be either 'Club Admin' or 'Club Member'.");
        }

        var club = await clubRepository.GetByIdAsync(command.ClubId, cancellationToken).ConfigureAwait(false);
        if (club is null)
        {
            return UpdateMemberRoleOutcome.NotFound("Club not found.");
        }

        var isRequestingAdmin = await clubRepository.IsClubAdminAsync(
            command.ClubId,
            command.RequestingMemberId,
            cancellationToken).ConfigureAwait(false);

        if (!isRequestingAdmin)
        {
            return UpdateMemberRoleOutcome.Forbidden("Only club administrators can modify member roles.");
        }

        var updated = await clubRepository.UpdateMemberRoleAsync(
            command.ClubId,
            command.TargetMemberId,
            command.Role,
            cancellationToken).ConfigureAwait(false);

        if (!updated)
        {
            return UpdateMemberRoleOutcome.NotFound("Target member not found in this club.");
        }

        var memberDetail = await clubRepository.GetClubMemberAsync(
            command.ClubId,
            command.TargetMemberId,
            cancellationToken).ConfigureAwait(false);

        return UpdateMemberRoleOutcome.Success(memberDetail!);
    }
}
