using ClubConnect.Application.Abstractions;
using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application.Members;

/// <summary>
/// Use case: Authenticate a club member with email and password.
/// Validates input format, queries member repository by canonical email,
/// and verifies the stored Argon2id password hash in a timing-safe manner.
/// </summary>
public class LoginMemberUseCase
{
    private readonly IMemberRepository _members;
    private readonly IPasswordHasher _passwordHasher;

    public LoginMemberUseCase(IMemberRepository members, IPasswordHasher passwordHasher)
    {
        _members = members ?? throw new ArgumentNullException(nameof(members));
        _passwordHasher = passwordHasher ?? throw new ArgumentNullException(nameof(passwordHasher));
    }

    public async Task<LoginMemberOutcome> ExecuteAsync(
        LoginMemberCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command is null || string.IsNullOrWhiteSpace(command.Password))
        {
            return new LoginMemberOutcome(LoginStatus.InvalidInput, Violation: "Email and password are required.");
        }

        var email = MemberEmail.Canonicalize(command.Email);
        if (email is null)
        {
            return new LoginMemberOutcome(LoginStatus.InvalidInput, Violation: "E-mail is not valid.");
        }

        var member = await _members.FindByEmailAsync(email, cancellationToken).ConfigureAwait(false);
        if (member is null)
        {
            return new LoginMemberOutcome(LoginStatus.InvalidCredentials, Violation: "Invalid email or password.");
        }

        var isValidPassword = _passwordHasher.Verify(command.Password, member.PasswordHash);
        if (!isValidPassword)
        {
            return new LoginMemberOutcome(LoginStatus.InvalidCredentials, Violation: "Invalid email or password.");
        }

        return new LoginMemberOutcome(
            LoginStatus.Success,
            MemberId: member.Id,
            Email: member.Email,
            DisplayName: member.DisplayName);
    }
}
