using ClubConnect.Application.Abstractions;
using ClubConnect.Domain.Entities;
using ClubConnect.Infrastructure.Security;
using Xunit;

namespace ClubConnect.Api.Tests;

public class JwtTokenServiceTests
{
    private readonly JwtTokenService _service = new(JwtTokenService.DefaultSecretKey, TimeSpan.FromMinutes(30));

    private static Member CreateMember(Guid? id = null, string email = "user@example.com", string name = "Test User") =>
        new()
        {
            Id = id ?? Guid.NewGuid(),
            Email = email,
            DisplayName = name,
            PasswordHash = "hash",
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

    [Fact]
    public void GenerateToken_ValidMember_ReturnsWellFormedJwt()
    {
        var member = CreateMember();
        var token = _service.GenerateToken(member);

        Assert.NotNull(token);
        var parts = token.Split('.');
        Assert.Equal(3, parts.Length);
    }

    [Fact]
    public void ValidateToken_ValidToken_ReturnsValidStatusWithClaims()
    {
        var member = CreateMember();
        var token = _service.GenerateToken(member);

        var result = _service.ValidateToken(token);

        Assert.Equal(JwtValidationStatus.Valid, result.Status);
        Assert.Equal(member.Id, result.MemberId);
        Assert.Equal(member.Email, result.Email);
        Assert.Equal(member.DisplayName, result.DisplayName);
    }

    [Fact]
    public void ValidateToken_ExpiredToken_ReturnsExpiredStatus()
    {
        var member = CreateMember();
        // Negative lifetime means it is already expired
        var token = _service.GenerateToken(member, TimeSpan.FromSeconds(-10));

        var result = _service.ValidateToken(token);

        Assert.Equal(JwtValidationStatus.Expired, result.Status);
    }

    [Fact]
    public void ValidateToken_TamperedSignature_ReturnsInvalid()
    {
        var member = CreateMember();
        var token = _service.GenerateToken(member);
        var parts = token.Split('.');
        var tampered = $"{parts[0]}.{parts[1]}.tampered_signature";

        var result = _service.ValidateToken(tampered);

        Assert.Equal(JwtValidationStatus.Invalid, result.Status);
    }

    [Fact]
    public void ValidateToken_MalformedToken_ReturnsInvalid()
    {
        Assert.Equal(JwtValidationStatus.Invalid, _service.ValidateToken(null!).Status);
        Assert.Equal(JwtValidationStatus.Invalid, _service.ValidateToken("").Status);
        Assert.Equal(JwtValidationStatus.Invalid, _service.ValidateToken("invalid.token").Status);
        Assert.Equal(JwtValidationStatus.Invalid, _service.ValidateToken("a.b.c.d").Status);
    }
}
