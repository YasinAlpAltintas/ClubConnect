namespace ClubConnect.Application.Members;

/// <summary>Status of a <see cref="RegisterMemberUseCase"/> run.</summary>
public enum RegisterStatus
{
    /// <summary>201 Created — a new member was registered.</summary>
    Created,
    /// <summary>400 Bad Request — the payload failed validation.</summary>
    Invalid,
    /// <summary>409 Conflict — a member with this canonical e-mail already exists.</summary>
    Conflict,
}

/// <summary>Outcome of a member registration run.</summary>
public sealed record RegisterMemberOutcome(
    RegisterStatus Status,
    string? Violation = null,
    Guid? MemberId = null,
    string? NormalizedEmail = null);
