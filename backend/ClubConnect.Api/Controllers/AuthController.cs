using ClubConnect.Application.Abstractions;
using ClubConnect.Application.Members;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace ClubConnect.Api.Controllers;

/// <summary>
/// Auth endpoints for member registration and authentication.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController(
    RegisterMemberUseCase registerMemberUseCase,
    LoginMemberUseCase loginMemberUseCase,
    IJwtTokenService? jwtTokenService = null,
    IMemberRepository? memberRepository = null) : ControllerBase
{
    private readonly IJwtTokenService _jwtTokenService =
        jwtTokenService ?? new Infrastructure.Security.JwtTokenService(new ConfigurationBuilder().Build());

    /// <summary>Request body for <c>POST /api/auth/register</c>.</summary>
    public sealed record RegisterRequest(
        [property: System.Text.Json.Serialization.JsonPropertyName("email")] string? Email,
        [property: System.Text.Json.Serialization.JsonPropertyName("password")] string? Password,
        [property: System.Text.Json.Serialization.JsonPropertyName("displayName")] string? DisplayName = null);

    /// <summary>Success payload for <c>POST /api/auth/register</c>.</summary>
    public sealed record RegisterResponse(
        Guid MemberId,
        string Email);

    /// <summary>Request body for <c>POST /api/auth/login</c>.</summary>
    public sealed record LoginRequest(
        [property: System.Text.Json.Serialization.JsonPropertyName("email")] string? Email,
        [property: System.Text.Json.Serialization.JsonPropertyName("password")] string? Password);

    /// <summary>Success payload for <c>POST /api/auth/login</c> and <c>GET /api/auth/me</c>.</summary>
    public sealed record LoginResponse(
        Guid MemberId,
        string Email,
        string DisplayName,
        string Token);

    /// <summary>Response payload for <c>GET /api/auth/check-email</c>.</summary>
    public sealed record CheckEmailResponse(
        string Email,
        bool Exists);

    /// <summary>
    /// Authenticates a club member.
    /// 200 → authenticated · 400 → invalid format · 401 → invalid credentials.
    /// </summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var command = new LoginMemberCommand
        {
            Email = request?.Email ?? string.Empty,
            Password = request?.Password ?? string.Empty,
        };

        var outcome = await loginMemberUseCase.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);

        if (outcome.Status == LoginStatus.Success)
        {
            var member = new Member
            {
                Id = outcome.MemberId!.Value,
                Email = outcome.Email!,
                DisplayName = outcome.DisplayName ?? string.Empty,
                PasswordHash = string.Empty,
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            var token = _jwtTokenService.GenerateToken(member);
            return Ok(new LoginResponse(outcome.MemberId!.Value, outcome.Email!, outcome.DisplayName ?? string.Empty, token));
        }

        return outcome.Status switch
        {
            LoginStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.Violation }),
            _ => Unauthorized(new { error = "invalid_credentials", detail = outcome.Violation ?? "Invalid email or password." })
        };
    }

    /// <summary>
    /// Retrieves the profile of the authenticated member using the Bearer token.
    /// 200 → authenticated · 401 → token missing, invalid, or expired.
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult GetProfile()
    {
        var authHeader = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Unauthorized(new { error = "unauthorized", detail = "Authorization header is missing or malformed." });
        }

        var token = authHeader["Bearer ".Length..].Trim();
        var result = _jwtTokenService.ValidateToken(token);

        return result.Status switch
        {
            JwtValidationStatus.Valid => Ok(new LoginResponse(result.MemberId!.Value, result.Email!, result.DisplayName ?? string.Empty, token)),
            JwtValidationStatus.Expired => Unauthorized(new { error = "token_expired", detail = "The session has expired. Please log in again." }),
            _ => Unauthorized(new { error = "invalid_token", detail = "The provided token is invalid." })
        };
    }

    /// <summary>
    /// Closes the authenticated session.
    /// 200 → session closed.
    /// </summary>
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult Logout()
    {
        return Ok(new { message = "Logged out successfully." });
    }

    /// <summary>
    /// Checks whether an email address already has an existing account.
    /// 200 → checked · 400 → invalid email format.
    /// </summary>
    [HttpGet("check-email")]
    [ProducesResponseType(typeof(CheckEmailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CheckEmail([FromQuery] string? email, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new { error = "invalid_input", detail = "Email is required." });
        }

        var canonical = MemberEmail.Canonicalize(email);
        if (canonical is null)
        {
            return BadRequest(new { error = "invalid_input", detail = "Invalid email format." });
        }

        if (memberRepository is null)
        {
            return Ok(new CheckEmailResponse(canonical, false));
        }

        var existing = await memberRepository.FindByEmailAsync(canonical, cancellationToken).ConfigureAwait(false);
        return Ok(new CheckEmailResponse(canonical, existing is not null));
    }

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
