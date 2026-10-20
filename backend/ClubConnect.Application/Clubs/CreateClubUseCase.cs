using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application.Clubs;

/// <summary>
/// Use case for creating a new club workspace and assigning the creator as Club Admin.
/// </summary>
public sealed class CreateClubUseCase(IClubRepository clubRepository)
{
    public const int MinNameLength = 2;
    public const int MaxNameLength = 100;
    public const int MaxDescriptionLength = 500;

    public async Task<CreateClubOutcome> ExecuteAsync(
        CreateClubCommand command,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (command.AdminMemberId == Guid.Empty)
        {
            return CreateClubOutcome.InvalidInput("Authenticated member ID is required.");
        }

        var trimmedName = command.Name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            return CreateClubOutcome.InvalidInput("Club name is required.");
        }

        if (trimmedName.Length < MinNameLength)
        {
            return CreateClubOutcome.InvalidInput($"Club name must be at least {MinNameLength} characters.");
        }

        if (trimmedName.Length > MaxNameLength)
        {
            return CreateClubOutcome.InvalidInput($"Club name cannot exceed {MaxNameLength} characters.");
        }

        var trimmedDescription = command.Description?.Trim();
        if (trimmedDescription is not null && trimmedDescription.Length > MaxDescriptionLength)
        {
            return CreateClubOutcome.InvalidInput($"Club description cannot exceed {MaxDescriptionLength} characters.");
        }

        try
        {
            var club = await clubRepository.CreateClubWithAdminAsync(
                trimmedName,
                trimmedDescription,
                command.AdminMemberId,
                cancellationToken).ConfigureAwait(false);

            return CreateClubOutcome.Success(
                club.Id,
                club.Name,
                club.Description,
                "Club Admin",
                club.CreatedAtUtc);
        }
        catch (Exception ex)
        {
            return CreateClubOutcome.Failure(ex.Message);
        }
    }
}
