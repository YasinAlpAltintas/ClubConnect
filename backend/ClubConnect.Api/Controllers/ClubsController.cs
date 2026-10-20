using System.Text.Json.Serialization;
using ClubConnect.Application.Abstractions;
using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using Microsoft.AspNetCore.Mvc;

namespace ClubConnect.Api.Controllers;

/// <summary>
/// Endpoints for creating and managing clubs.
/// </summary>
[ApiController]
[Route("api/clubs")]
public class ClubsController(
    CreateClubUseCase createClubUseCase,
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
        DateTimeOffset CreatedAtUtc);

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
                outcome.CreatedAtUtc!.Value)),
            CreateClubStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.Violation }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new { error = "creation_failed", detail = outcome.Violation })
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
}
