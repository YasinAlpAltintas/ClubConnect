using ClubConnect.Application.Members;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClubConnect.Api.Controllers;

/// <summary>
/// Auth endpoints. Story 1 only exposes <c>POST /api/auth/register</c>; JWT,
/// refresh, and sign-in arrive in Stories 3–5.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController(RegisterMemberUseCase registerMemberUseCase) : ControllerBase
{
    /// <summary>Request body for <c>POST /api/auth/register</c>.</summary>
    public sealed record RegisterRequest(
        [property: System.Text.Json.Serialization.JsonPropertyName("email")] string? Email,
        [property: System.Text.Json.Serialization.JsonPropertyName("password")] string? Password,
        [property: System.Text.Json.Serialization.JsonPropertyName("displayName")] string? DisplayName = null);

    /// <summary>Success payload for <c>POST /api/auth/register</c>.</summary>
    public sealed record RegisterResponse(
        Guid MemberId,
        string Email);

    /// <summary>
    /// Creates a new club member account.
    /// 201 → created · 400 → invalid email or password · 409 → email already taken.
    /// </summary>
    [HttpPost("register")]
    [ProducesResponseType(201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var command = new RegisterMemberCommand
        {
            Email = request.Email ?? string.Empty,
            Password = request.Password ?? string.Empty,
            DisplayName = request.DisplayName ?? string.Empty,
        };

        var outcome = await SafeRegisterAsync(command, cancellationToken).ConfigureAwait(false);

        switch (outcome.Status)
        {
            case RegisterStatus.Created:
            {
                var response = new RegisterResponse(outcome.MemberId!.Value, outcome.NormalizedEmail!);
                return new ObjectResult(response) { StatusCode = StatusCodes.Status201Created };
            }
            case RegisterStatus.Conflict:
                return Conflict(new { error = "email_conflict", detail = outcome.Violation });
            default:
                return BadRequest(new { error = "invalid_input", detail = outcome.Violation });
        }
    }

    private async Task<RegisterMemberOutcome> SafeRegisterAsync(
        RegisterMemberCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            return await registerMemberUseCase.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            // Lost a race with another request that inserted the same canonical email.
            return new RegisterMemberOutcome(RegisterStatus.Conflict, "E-mail is already registered.");
        }
    }

    private static bool IsUniqueConstraintViolation(Exception top)
    {
        for (var e = top; e is not null; e = e.InnerException)
        {
            if (e.Message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase)
                || e.Message.Contains("unique constraint", StringComparison.OrdinalIgnoreCase)
                || e.Message.Contains("23505", StringComparison.Ordinal))
            {
                return true;
            }
        }

        return top is DbUpdateException du
               && du.Entries.Any(en => en.Entity is Domain.Entities.Member);
    }
}
