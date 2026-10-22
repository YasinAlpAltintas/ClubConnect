using System.Text.RegularExpressions;
using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Use case for joining an existing club workspace using a 6-digit invite code.
/// Assigns the member the "Club Member" role.
/// </summary>
public sealed class JoinClubUseCase(IClubRepository clubRepository)
{
    private static readonly Regex SixDigitRegex = new(@"^\d{6}$", RegexOptions.Compiled);

    public async Task<JoinClubOutcome> ExecuteAsync(
        JoinClubCommand command,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (command.MemberId == Guid.Empty)
        {
            return JoinClubOutcome.InvalidInput("Authenticated member ID is required.");
        }

        var trimmedCode = command.Code?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedCode))
        {
            return JoinClubOutcome.InvalidInput("Invite code is required.");
        }

        if (!SixDigitRegex.IsMatch(trimmedCode))
        {
            return JoinClubOutcome.InvalidInput("Invite code must consist of exactly 6 digits.");
        }

        try
        {
            var result = await clubRepository
                .JoinClubByInviteCodeAsync(trimmedCode, command.MemberId, cancellationToken)
                .ConfigureAwait(false);

            return result.Status switch
            {
                JoinClubRepositoryStatus.Success => JoinClubOutcome.Success(
                    result.ClubId!.Value,
                    result.Name!,
                    result.Description,
                    result.Role!,
                    result.JoinedAtUtc!.Value),
                JoinClubRepositoryStatus.NotFound => JoinClubOutcome.NotFound(
                    result.ErrorMessage ?? "Invalid or unknown invite code."),
                JoinClubRepositoryStatus.Expired => JoinClubOutcome.Expired(
                    result.ErrorMessage ?? "The invite code has expired."),
                JoinClubRepositoryStatus.AlreadyMember => JoinClubOutcome.AlreadyMember(
                    result.ClubId,
                    result.Name,
                    result.ErrorMessage ?? "You are already a member of this club."),
                _ => JoinClubOutcome.Failure(result.ErrorMessage ?? "Failed to join club.")
            };
        }
        catch (Exception ex)
        {
            return JoinClubOutcome.Failure(ex.Message);
        }
    }
}
