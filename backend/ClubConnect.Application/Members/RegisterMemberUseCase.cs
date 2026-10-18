using ClubConnect.Application.Abstractions;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;

namespace ClubConnect.Application.Members;

/// <summary>
/// Use case: create a club member account.
/// <para>
/// Behaviour:
/// <list type="number">
/// <item>Validates the e-mail (canonicalization) and password policy.</item>
/// <item>Rejects duplicate canonical e-mails with a <see cref="RegisterStatus.Conflict"/>.</item>
/// <item>Persists the new member using the injected <see cref="IPasswordHasher"/>.</item>
/// </list>
/// </para>
/// The class is side-effect free until <see cref="ExecuteAsync"/> is awaited;
/// it performs no I/O of its own.
/// </summary>
public class RegisterMemberUseCase
{
    private readonly IMemberRepository _members;
    private readonly IPasswordHasher _passwordHasher;

    public RegisterMemberUseCase(IMemberRepository members, IPasswordHasher passwordHasher)
    {
        _members = members ?? throw new ArgumentNullException(nameof(members));
        _passwordHasher = passwordHasher ?? throw new ArgumentNullException(nameof(passwordHasher));
    }

    public async Task<RegisterMemberOutcome> ExecuteAsync(
        RegisterMemberCommand command,
        CancellationToken cancellationToken = default)
    {
        var email = MemberEmail.Canonicalize(command?.Email);
        if (email is null)
            return new RegisterMemberOutcome(RegisterStatus.Invalid, "E-mail is not valid.");

        var passwordProblem = MemberPassword.Validate(command?.Password);
        if (passwordProblem is not null)
            return new RegisterMemberOutcome(RegisterStatus.Invalid, passwordProblem);

        var existing = await _members.FindByEmailAsync(email, cancellationToken).ConfigureAwait(false);
        if (existing is not null)
            return new RegisterMemberOutcome(RegisterStatus.Conflict);

        var member = new Member
        {
            Email = email,
            PasswordHash = _passwordHasher.Hash(command?.Password ?? string.Empty),
            DisplayName = (command?.DisplayName ?? string.Empty).Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        var saved = await _members.AddAsync(member, cancellationToken).ConfigureAwait(false);
        return new RegisterMemberOutcome(
            RegisterStatus.Created,
            MemberId: saved.Id,
            NormalizedEmail: saved.Email);
    }
}
