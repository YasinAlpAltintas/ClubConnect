namespace ClubConnect.Application.Clubs;

public enum CreateClubStatus
{
    Success,
    InvalidInput,
    Failure
}

/// <summary>
/// Result of executing <see cref="CreateClubUseCase"/>.
/// </summary>
public sealed record CreateClubOutcome
{
    public CreateClubStatus Status { get; init; }
    public Guid? ClubId { get; init; }
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? Role { get; init; }
    public DateTimeOffset? CreatedAtUtc { get; init; }
    public string? Violation { get; init; }

    public static CreateClubOutcome Success(Guid clubId, string name, string? description, string role, DateTimeOffset createdAtUtc) =>
        new()
        {
            Status = CreateClubStatus.Success,
            ClubId = clubId,
            Name = name,
            Description = description,
            Role = role,
            CreatedAtUtc = createdAtUtc
        };

    public static CreateClubOutcome InvalidInput(string violation) =>
        new()
        {
            Status = CreateClubStatus.InvalidInput,
            Violation = violation
        };

    public static CreateClubOutcome Failure(string error) =>
        new()
        {
            Status = CreateClubStatus.Failure,
            Violation = error
        };
}
