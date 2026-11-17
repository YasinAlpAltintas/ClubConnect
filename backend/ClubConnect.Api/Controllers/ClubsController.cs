using System.Text.Json.Serialization;
using ClubConnect.Application.Abstractions;
using ClubConnect.Application.Clubs;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
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
    IClubRepository? clubRepository = null,
    GetClubMembersUseCase? getClubMembersUseCase = null,
    UpdateMemberRoleUseCase? updateMemberRoleUseCase = null,
    RemoveClubMemberUseCase? removeClubMemberUseCase = null,
    GetClubEventsUseCase? getClubEventsUseCase = null,
    CreateClubEventUseCase? createClubEventUseCase = null,
    UpdateClubEventUseCase? updateClubEventUseCase = null) : ControllerBase
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

    /// <summary>Response item for <c>GET /api/clubs/{id}/members</c>.</summary>
    public sealed record ClubMemberResponse(
        Guid MemberId,
        string DisplayName,
        string Email,
        string Role,
        DateTimeOffset JoinedAtUtc);

    /// <summary>
    /// Retrieves all members of the specified club workspace.
    /// Enforces strict admin authorization and tenant isolation:
    /// 200 → members list · 401 → unauthenticated · 403 → forbidden (not a Club Admin of this club) · 404 → club not found.
    /// </summary>
    [HttpGet("{id:guid}/members")]
    [ProducesResponseType(typeof(IEnumerable<ClubMemberResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetClubMembers([FromRoute] Guid id, CancellationToken cancellationToken)
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

        if (getClubMembersUseCase is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "service_unavailable", detail = "Member retrieval service is unavailable." });
        }

        var query = new GetClubMembersQuery
        {
            ClubId = id,
            RequestingMemberId = validation.MemberId.Value
        };

        var outcome = await getClubMembersUseCase.ExecuteAsync(query, cancellationToken).ConfigureAwait(false);

        return outcome.Status switch
        {
            GetClubMembersStatus.Success => Ok(outcome.Members.Select(m => new ClubMemberResponse(
                m.MemberId,
                m.DisplayName,
                m.Email,
                m.Role,
                m.JoinedAtUtc))),
            GetClubMembersStatus.NotFound => NotFound(new { error = "not_found", detail = outcome.Violation }),
            GetClubMembersStatus.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", detail = outcome.Violation }),
            GetClubMembersStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.Violation }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new { error = "retrieval_failed", detail = outcome.Violation })
        };
    }

    /// <summary>Request body for <c>PATCH /api/clubs/{id}/members/{memberId}/role</c>.</summary>
    public sealed record UpdateMemberRoleRequest(
        [property: JsonPropertyName("role")] string? Role);

    /// <summary>
    /// Updates the role of a club member (e.g. promoting a "Club Member" to "Club Admin").
    /// Requires the authenticated user to be a "Club Admin" of the specified club.
    /// 200 → role updated · 400 → invalid input · 401 → unauthenticated · 403 → forbidden · 404 → not found.
    /// </summary>
    [HttpPatch("{id:guid}/members/{memberId:guid}/role")]
    [ProducesResponseType(typeof(ClubMemberResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMemberRole(
        [FromRoute] Guid id,
        [FromRoute] Guid memberId,
        [FromBody] UpdateMemberRoleRequest request,
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

        if (updateMemberRoleUseCase is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "service_unavailable", detail = "Member role management service is unavailable." });
        }

        var command = new UpdateMemberRoleCommand
        {
            ClubId = id,
            RequestingMemberId = validation.MemberId.Value,
            TargetMemberId = memberId,
            Role = request?.Role ?? string.Empty
        };

        var outcome = await updateMemberRoleUseCase.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);

        return outcome.Status switch
        {
            UpdateMemberRoleStatus.Success => Ok(new ClubMemberResponse(
                outcome.Member!.MemberId,
                outcome.Member.DisplayName,
                outcome.Member.Email,
                outcome.Member.Role,
                outcome.Member.JoinedAtUtc)),
            UpdateMemberRoleStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.Violation }),
            UpdateMemberRoleStatus.NotFound => NotFound(new { error = "not_found", detail = outcome.Violation }),
            UpdateMemberRoleStatus.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", detail = outcome.Violation }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new { error = "update_failed", detail = outcome.Violation })
        };
    }

    /// <summary>
    /// Removes a member from the club workspace, immediately revoking their access to the club and its data.
    /// Requires the authenticated user to be a "Club Admin" of the specified club.
    /// 204 → member removed · 400 → invalid input or cannot remove sole admin · 401 → unauthenticated · 403 → forbidden · 404 → not found.
    /// </summary>
    [HttpDelete("{id:guid}/members/{memberId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveMember(
        [FromRoute] Guid id,
        [FromRoute] Guid memberId,
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

        if (removeClubMemberUseCase is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "service_unavailable", detail = "Member removal service is unavailable." });
        }

        var command = new RemoveClubMemberCommand
        {
            ClubId = id,
            RequestingMemberId = validation.MemberId.Value,
            TargetMemberId = memberId
        };

        var outcome = await removeClubMemberUseCase.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);

        return outcome.Status switch
        {
            RemoveClubMemberStatus.Success => NoContent(),
            RemoveClubMemberStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.Violation }),
            RemoveClubMemberStatus.NotFound => NotFound(new { error = "not_found", detail = outcome.Violation }),
            RemoveClubMemberStatus.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", detail = outcome.Violation }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new { error = "removal_failed", detail = outcome.Violation })
        };
    }

    /// <summary>Request body for <c>POST /api/clubs/{id}/events</c>.</summary>
    public sealed record CreateClubEventRequest(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("location")] string? Location,
        [property: JsonPropertyName("startTimeUtc")] DateTimeOffset StartTimeUtc,
        [property: JsonPropertyName("endTimeUtc")] DateTimeOffset EndTimeUtc);

    /// <summary>Attendee item representation for event RSVP (INC-26).</summary>
    public sealed record ClubEventAttendeeResponse(
        Guid MemberId,
        string DisplayName,
        string Email,
        DateTimeOffset RsvpAtUtc);

    /// <summary>Response item for <c>GET /api/clubs/{id}/events</c>.</summary>
    public sealed record ClubEventResponse(
        Guid Id,
        Guid ClubId,
        string Title,
        string? Description,
        string? Location,
        DateTimeOffset StartTimeUtc,
        DateTimeOffset EndTimeUtc,
        Guid CreatedByMemberId,
        DateTimeOffset CreatedAtUtc,
        int AttendeeCount = 0,
        bool IsAttending = false,
        IReadOnlyList<ClubEventAttendeeResponse>? Attendees = null);

    private static ClubEventResponse MapToEventResponse(ClubEvent e, Guid requestingMemberId)
    {
        var attendeeList = (e.Attendees ?? Array.Empty<ClubEventAttendee>())
            .Select(a => new ClubEventAttendeeResponse(
                a.MemberId,
                string.IsNullOrWhiteSpace(a.Member?.DisplayName) ? string.Empty : a.Member.DisplayName,
                a.Member?.Email ?? string.Empty,
                a.RsvpAtUtc))
            .ToList();

        var isAttending = (e.Attendees ?? Array.Empty<ClubEventAttendee>())
            .Any(a => a.MemberId == requestingMemberId);

        return new ClubEventResponse(
            e.Id,
            e.ClubId,
            e.Title,
            e.Description,
            e.Location,
            e.StartTimeUtc,
            e.EndTimeUtc,
            e.CreatedByMemberId,
            e.CreatedAtUtc,
            attendeeList.Count,
            isAttending,
            attendeeList);
    }

    /// <summary>
    /// Retrieves scheduled events for the specified club workspace (INC-23).
    /// Filterable by year and month.
    /// Enforces tenant isolation: only authenticated members of the club can view its calendar.
    /// 200 → events list · 400 → invalid year/month · 401 → unauthenticated · 403 → forbidden · 404 → club not found.
    /// </summary>
    [HttpGet("{id:guid}/events")]
    [ProducesResponseType(typeof(IEnumerable<ClubEventResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetClubEvents(
        [FromRoute] Guid id,
        [FromQuery] int? year,
        [FromQuery] int? month,
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

        if (getClubEventsUseCase is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "service_unavailable", detail = "Event retrieval service is unavailable." });
        }

        var query = new GetClubEventsQuery
        {
            ClubId = id,
            RequestingMemberId = validation.MemberId.Value,
            Year = year,
            Month = month
        };

        var outcome = await getClubEventsUseCase.ExecuteAsync(query, cancellationToken).ConfigureAwait(false);

        return outcome.Status switch
        {
            GetClubEventsStatus.Success => Ok(outcome.Events.Select(e => MapToEventResponse(e, validation.MemberId.Value))),
            GetClubEventsStatus.NotFound => NotFound(new { error = "not_found", detail = outcome.Violation }),
            GetClubEventsStatus.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", detail = outcome.Violation }),
            GetClubEventsStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.Violation }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new { error = "retrieval_failed", detail = outcome.Violation })
        };
    }

    /// <summary>
    /// Schedules a new event for the specified club workspace (INC-24).
    /// Enforces multi-tenant authorization: only authenticated Club Admins of the club can schedule events.
    /// 201 → created event · 400 → invalid title / time bounds · 401 → unauthenticated · 403 → forbidden · 404 → club not found.
    /// </summary>
    [HttpPost("{id:guid}/events")]
    [ProducesResponseType(typeof(ClubEventResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateClubEvent(
        [FromRoute] Guid id,
        [FromBody] CreateClubEventRequest request,
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

        if (createClubEventUseCase is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "service_unavailable", detail = "Event creation service is unavailable." });
        }

        if (request is null)
        {
            return BadRequest(new { error = "invalid_input", detail = "Request body is required." });
        }

        var command = new CreateClubEventCommand
        {
            ClubId = id,
            AdminMemberId = validation.MemberId.Value,
            Title = request.Title ?? string.Empty,
            Description = request.Description,
            Location = request.Location,
            StartTimeUtc = request.StartTimeUtc,
            EndTimeUtc = request.EndTimeUtc
        };

        var outcome = await createClubEventUseCase.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);

        return outcome.Status switch
        {
            CreateClubEventStatus.Success => CreatedAtAction(
                nameof(GetClubEvents),
                new { id = outcome.Event!.ClubId },
                MapToEventResponse(outcome.Event, validation.MemberId.Value)),
            CreateClubEventStatus.NotFound => NotFound(new { error = "not_found", detail = outcome.Violation }),
            CreateClubEventStatus.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", detail = outcome.Violation }),
            CreateClubEventStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.Violation }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new { error = "creation_failed", detail = outcome.Violation })
        };
    }

    /// <summary>Request body for <c>PUT /api/clubs/{id}/events/{eventId}</c> (INC-25).</summary>
    public sealed record UpdateClubEventRequest(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("location")] string? Location,
        [property: JsonPropertyName("startTimeUtc")] DateTimeOffset StartTimeUtc,
        [property: JsonPropertyName("endTimeUtc")] DateTimeOffset EndTimeUtc);

    /// <summary>
    /// Updates a scheduled event in the club workspace (INC-25).
    /// Enforces multi-tenant authorization: only authenticated Club Admins of the club can update events.
    /// 200 → updated event · 400 → validation error · 401 → unauthenticated · 403 → forbidden · 404 → club or event not found.
    /// </summary>
    [HttpPut("{id:guid}/events/{eventId:guid}")]
    [ProducesResponseType(typeof(ClubEventResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateClubEvent(
        [FromRoute] Guid id,
        [FromRoute] Guid eventId,
        [FromBody] UpdateClubEventRequest request,
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

        if (updateClubEventUseCase is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "service_unavailable", detail = "Event update service is unavailable." });
        }

        if (request is null)
        {
            return BadRequest(new { error = "invalid_input", detail = "Request body is required." });
        }

        var command = new UpdateClubEventCommand(
            ClubId: id,
            EventId: eventId,
            AdminMemberId: validation.MemberId.Value,
            Title: request.Title ?? string.Empty,
            Description: request.Description,
            Location: request.Location,
            StartTimeUtc: request.StartTimeUtc,
            EndTimeUtc: request.EndTimeUtc);

        var outcome = await updateClubEventUseCase.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);

        return outcome.Status switch
        {
            UpdateClubEventStatus.Success => Ok(MapToEventResponse(outcome.Event!, validation.MemberId.Value)),
            UpdateClubEventStatus.NotFound => NotFound(new { error = "not_found", detail = outcome.ErrorMessage }),
            UpdateClubEventStatus.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", detail = outcome.ErrorMessage }),
            UpdateClubEventStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.ErrorMessage }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new { error = "update_failed", detail = outcome.ErrorMessage })
        };
    }

    /// <summary>Request body for <c>POST /api/clubs/{id}/events/{eventId}/rsvp</c> (INC-26).</summary>
    public sealed record EventRsvpRequest(
        [property: JsonPropertyName("isAttending")] bool IsAttending);

    /// <summary>
    /// Records or cancels an RSVP attendance for a scheduled event (INC-26).
    /// Enforces multi-tenant isolation: only active members of the requested club can RSVP.
    /// 200 → updated event response · 400 → invalid input · 401 → unauthenticated · 403 → forbidden · 404 → not found.
    /// </summary>
    [HttpPost("{id:guid}/events/{eventId:guid}/rsvp")]
    [ProducesResponseType(typeof(ClubEventResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetEventRsvp(
        [FromRoute] Guid id,
        [FromRoute] Guid eventId,
        [FromBody] EventRsvpRequest request,
        [FromServices] SetEventRsvpUseCase setEventRsvpUseCase,
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

        if (setEventRsvpUseCase is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "service_unavailable", detail = "RSVP service is unavailable." });
        }

        if (request is null)
        {
            return BadRequest(new { error = "invalid_input", detail = "Request body is required." });
        }

        var command = new SetEventRsvpCommand(
            ClubId: id,
            EventId: eventId,
            MemberId: validation.MemberId.Value,
            IsAttending: request.IsAttending);

        var outcome = await setEventRsvpUseCase.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);

        return outcome.Status switch
        {
            SetEventRsvpStatus.Success => Ok(MapToEventResponse(outcome.Event!, validation.MemberId.Value)),
            SetEventRsvpStatus.NotFound => NotFound(new { error = "not_found", detail = outcome.ErrorMessage }),
            SetEventRsvpStatus.Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", detail = outcome.ErrorMessage }),
            SetEventRsvpStatus.InvalidInput => BadRequest(new { error = "invalid_input", detail = outcome.ErrorMessage }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new { error = "rsvp_failed", detail = outcome.ErrorMessage })
        };
    }
}
