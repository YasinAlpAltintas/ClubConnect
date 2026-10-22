namespace ClubConnect.Application.Clubs;

/// <summary>
/// Status outcome for a join club operation.
/// </summary>
public enum JoinClubStatus
{
    Success,
    InvalidInput,
    NotFound,
    Expired,
    AlreadyMember,
    Failure
}

/// <summary>
/// Domain outcome returned by <see cref="JoinClubUseCase"/>.
/// </summary>
public sealed record JoinClubOutcome
{
    public JoinClubStatus Status { get; init; }

    public Guid? ClubId { get; init; }

    public string? Name { get; init; }

    public string? Description { get; init; }

    public string? Role { get; init; }

    public DateTimeOffset? JoinedAtUtc { get; init; }

    public string? Violation { get; init; }

    public static JoinClubOutcome Success(
        Guid clubId,
        string name,
        string? description,
        string role,
        DateTimeOffset joinedAtUtc) =>
        new()
        {
            Status = JoinClubStatus.Success,
            ClubId = clubId,
            Name = name,
            Description = description,
            Role = role,
            JoinedAtUtc = joinedAtUtc
        };

    public static JoinClubOutcome InvalidInput(string violation) =>
        new() { Status = JoinClubStatus.InvalidInput, Violation = violation };

    public static JoinClubOutcome NotFound(string violation = "Invalid or unknown invite code.") =>
        new() { Status = JoinClubStatus.NotFound, Violation = violation };

    public static JoinClubOutcome Expired(string violation = "The invite code has expired.") =>
        new() { Status = JoinClubStatus.Expired, Violation = violation };

    public static JoinClubOutcome AlreadyMember(Guid? clubId = null, string? name = null, string violation = "You are already a member of this club.") =>
        new() { Status = JoinClubStatus.AlreadyMember, ClubId = clubId, Name = name, Violation = violation };

    public static JoinClubOutcome Failure(string error) =>
        new() { Status = JoinClubStatus.Failure, Violation = error };
}
