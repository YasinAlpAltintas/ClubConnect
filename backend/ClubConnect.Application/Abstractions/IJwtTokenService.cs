using ClubConnect.Domain.Entities;

namespace ClubConnect.Application.Abstractions;

/// <summary>
/// Status of a JWT token validation attempt.
/// </summary>
public enum JwtValidationStatus
{
    Valid,
    Expired,
    Invalid
}

/// <summary>
/// Result of validating a JWT token.
/// </summary>
public sealed record JwtValidationResult(
    JwtValidationStatus Status,
    Guid? MemberId = null,
    string? Email = null,
    string? DisplayName = null);

/// <summary>
/// Service for generating and validating JSON Web Tokens (JWT).
/// </summary>
public interface IJwtTokenService
{
    /// <summary>Generates a signed JWT for the specified member.</summary>
    string GenerateToken(Member member, TimeSpan? lifetime = null);

    /// <summary>Validates a JWT and extracts claims if valid.</summary>
    JwtValidationResult ValidateToken(string token);
}
