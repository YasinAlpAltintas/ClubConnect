using System.Text.Json.Serialization;
using ClubConnect.Application.Abstractions;
using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ClubConnect.Api.Controllers;

/// <summary>
/// Endpoints for creating, managing, and joining clubs.
/// </summary>
[ApiController]
[Route("api/clubs")]
public class ClubsController(
    CreateClubUseCase createClubUseCase,
    JoinClubUseCase joinClubUseCase,
    IJwtTokenService? jwtTokenService = null,
    IClubRepository? clubRepository = null) : ControllerBase
{
    private readonly IJwtTokenService _jwtTokenService =
        jwtTokenService ?? new Infrastructure.Security.JwtTokenService(new ConfigurationBuilder().Build());

    /// <summary>Request body for <c>POST /api/clubs</c>.</summary>
    public sealed record CreateClubRequest(
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("description")] string? Description = null);

    /// <summary>Response body for <c>POST /api/clubs</c>.</summary>
    public sealed record CreateClubResponse(
        Guid Id,
        string Name,
        string? Description,
        string Role,
        DateTimeOffset CreatedAtUtc,
        string? InviteCode = null);

    /// <summary>Request body for <c>POST /api/clubs/join</c>.</summary>
    public sealed record JoinClubRequest(
        [property: JsonPropertyName("code")] string? Code);

    /// <summary>Response body for <c>POST /api/clubs/join</c>.</summary>
    public sealed record JoinClubResponse(
        Guid ClubId,
        string Name,
        string? Description,
        string Role,
        DateTimeOffset JoinedAtUtc);

    /// <summary>
    /// Creates a new club workspace and assigns the authenticated member as Club Admin.
    /// 201 → created · 400 → validation error · 401 → unauthenticated.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CreateClubResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateClub(
        [FromBody] CreateClubRequest request,
        CancellationToken cancellationToken)
    {
        var authHeader = Request?.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Unauthorized(new { error = "unauthorized", detail = "Authorization header is missing or malformed." });
        }

        var token = authHeader["Bearer ".Length..].Trim();
        var validation = _jwtTokenService.ValidateToken(token);

        if (validation.Status == JwtValidationStatus.Expired)
        {
            return Unauthorized(new { error = "token_expired", detail = "The session has expired. Please log in again." });
        }

        if (validation.Status != JwtValidationStatus.Valid || validation.MemberId is null)
        {
            return Unauthorized(new { error = "invalid_token", detail = "The provided token is invalid." });
        }

        var command = new CreateClubCommand
        {
            Name = request?.Name ?? string.Empty,
            Description = request?.Description,
            AdminMemberId = validation.MemberId.Value
        };

        var outcome = await createClubUseCase.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);

        return outcome.Status switch
        {
            CreateClubStatus.Success => StatusCode(StatusCodes.Status201Created, new CreateClubResponse(
                outcome.ClubId!.Value,
                outcome.Name!,
                outcome.Description,
                outcome.Role!,
                outcome.CreatedAtUtc!.Value,
                outcome.InviteCode)),
            CreateClubStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.Violation }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new { error = "creation_failed", detail = outcome.Violation })
        };
    }

    /// <summary>
    /// Joins an existing club using an exact 6-digit invite code.
    /// 200 → joined as Club Member · 400 → invalid input · 401 → unauthorized · 404 → not found · 409 → already a member · 429 → rate limited.
    /// </summary>
    [HttpPost("join")]
    [EnableRateLimiting("invite-code-policy")]
    [ProducesResponseType(typeof(JoinClubResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> JoinClub(
        [FromBody] JoinClubRequest request,
        CancellationToken cancellationToken)
    {
        var authHeader = Request?.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Unauthorized(new { error = "unauthorized", detail = "Authorization header is missing or malformed." });
        }

        var token = authHeader["Bearer ".Length..].Trim();
        var validation = _jwtTokenService.ValidateToken(token);

        if (validation.Status == JwtValidationStatus.Expired)
        {
            return Unauthorized(new { error = "token_expired", detail = "The session has expired. Please log in again." });
        }

        if (validation.Status != JwtValidationStatus.Valid || validation.MemberId is null)
        {
            return Unauthorized(new { error = "invalid_token", detail = "The provided token is invalid." });
        }

        var command = new JoinClubCommand
        {
            MemberId = validation.MemberId.Value,
            Code = request?.Code ?? string.Empty
        };

        var outcome = await joinClubUseCase.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);

        return outcome.Status switch
        {
            JoinClubStatus.Success => Ok(new JoinClubResponse(
                outcome.ClubId!.Value,
                outcome.Name!,
                outcome.Description,
                outcome.Role!,
                outcome.JoinedAtUtc!.Value)),
            JoinClubStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.Violation }),
            JoinClubStatus.NotFound => NotFound(new { error = "invalid_code", detail = outcome.Violation }),
            JoinClubStatus.Expired => StatusCode(StatusCodes.Status410Gone, new { error = "expired_code", detail = outcome.Violation }),
            JoinClubStatus.AlreadyMember => Conflict(new { error = "already_member", detail = outcome.Violation }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new { error = "join_failed", detail = outcome.Violation })
        };
    }

    /// <summary>
    /// Retrieves clubs for the authenticated member.
    /// 200 → list of clubs · 401 → unauthenticated.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<ClubMembershipSummary>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetClubs(CancellationToken cancellationToken)
    {
        var authHeader = Request?.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Unauthorized(new { error = "unauthorized", detail = "Authorization header is missing or malformed." });
        }

        var token = authHeader["Bearer ".Length..].Trim();
        var validation = _jwtTokenService.ValidateToken(token);

        if (validation.Status == JwtValidationStatus.Expired)
        {
            return Unauthorized(new { error = "token_expired", detail = "The session has expired. Please log in again." });
        }

        if (validation.Status != JwtValidationStatus.Valid || validation.MemberId is null)
        {
            return Unauthorized(new { error = "invalid_token", detail = "The provided token is invalid." });
        }

        if (clubRepository is null)
        {
            return Ok(Array.Empty<ClubMembershipSummary>());
        }

        var clubs = await clubRepository.GetClubsForMemberAsync(validation.MemberId.Value, cancellationToken).ConfigureAwait(false);
        return Ok(clubs);
    }

    /// <summary>
    /// Retrieves details of a specific club workspace for the authenticated member.
    /// Enforces tenant isolation: 200 → club details · 401 → unauthenticated · 403 → forbidden (not a member) · 404 → club not found.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ClubMembershipSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetClubById([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var authHeader = Request?.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Unauthorized(new { error = "unauthorized", detail = "Authorization header is missing or malformed." });
        }

        var token = authHeader["Bearer ".Length..].Trim();
        var validation = _jwtTokenService.ValidateToken(token);

        if (validation.Status == JwtValidationStatus.Expired)
        {
            return Unauthorized(new { error = "token_expired", detail = "The session has expired. Please log in again." });
        }

        if (validation.Status != JwtValidationStatus.Valid || validation.MemberId is null)
        {
            return Unauthorized(new { error = "invalid_token", detail = "The provided token is invalid." });
        }

        if (clubRepository is null)
        {
            return NotFound(new { error = "not_found", detail = "Club not found." });
        }

        // Verify if club exists at all
        var club = await clubRepository.GetByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (club is null)
        {
            return NotFound(new { error = "not_found", detail = "Club not found." });
        }

        // Verify tenant isolation: does the authenticated member belong to this club?
        var summary = await clubRepository.GetClubForMemberAsync(id, validation.MemberId.Value, cancellationToken).ConfigureAwait(false);
        if (summary is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", detail = "You do not have access to this club workspace." });
        }

        return Ok(summary);
    }
}
