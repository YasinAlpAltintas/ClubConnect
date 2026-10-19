using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ClubConnect.Application.Abstractions;
using ClubConnect.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace ClubConnect.Infrastructure.Security;

/// <summary>
/// Issues and validates standard HMAC-SHA256 signed JSON Web Tokens (JWT).
/// </summary>
public sealed class JwtTokenService : IJwtTokenService
{
    public const string DefaultSecretKey = "clubconnect_super_secret_jwt_signing_key_2026_at_least_32_bytes_long!";
    public static readonly TimeSpan DefaultLifetime = TimeSpan.FromHours(1);

    private readonly byte[] _keyBytes;
    private readonly TimeSpan _lifetime;

    public JwtTokenService(IConfiguration configuration)
    {
        var secret = configuration["ClubConnect:Jwt:SecretKey"]
            ?? configuration["Jwt:SecretKey"]
            ?? DefaultSecretKey;

        _keyBytes = Encoding.UTF8.GetBytes(secret);

        var lifetimeSeconds = configuration.GetValue<int?>("ClubConnect:Jwt:LifetimeSeconds")
            ?? configuration.GetValue<int?>("Jwt:LifetimeSeconds");

        _lifetime = lifetimeSeconds.HasValue
            ? TimeSpan.FromSeconds(lifetimeSeconds.Value)
            : DefaultLifetime;
    }

    public JwtTokenService(string secretKey, TimeSpan? defaultLifetime = null)
    {
        _keyBytes = Encoding.UTF8.GetBytes(secretKey);
        _lifetime = defaultLifetime ?? DefaultLifetime;
    }

    public string GenerateToken(Member member, TimeSpan? lifetime = null)
    {
        ArgumentNullException.ThrowIfNull(member);

        var now = DateTimeOffset.UtcNow;
        var exp = now.Add(lifetime ?? _lifetime);

        var headerObj = new { alg = "HS256", typ = "JWT" };
        var payloadObj = new Dictionary<string, object>
        {
            ["sub"] = member.Id.ToString(),
            ["email"] = member.Email,
            ["name"] = member.DisplayName ?? string.Empty,
            ["iat"] = now.ToUnixTimeSeconds(),
            ["exp"] = exp.ToUnixTimeSeconds()
        };

        var headerJson = JsonSerializer.Serialize(headerObj);
        var payloadJson = JsonSerializer.Serialize(payloadObj);

        var headerEncoded = Base64UrlEncode(Encoding.UTF8.GetBytes(headerJson));
        var payloadEncoded = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

        var unsignedToken = $"{headerEncoded}.{payloadEncoded}";
        var signatureBytes = ComputeHmacSha256(unsignedToken, _keyBytes);
        var signatureEncoded = Base64UrlEncode(signatureBytes);

        return $"{unsignedToken}.{signatureEncoded}";
    }

    public JwtValidationResult ValidateToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return new JwtValidationResult(JwtValidationStatus.Invalid);
        }

        var parts = token.Split('.');
        if (parts.Length != 3)
        {
            return new JwtValidationResult(JwtValidationStatus.Invalid);
        }

        var unsignedToken = $"{parts[0]}.{parts[1]}";
        var expectedSignature = Base64UrlEncode(ComputeHmacSha256(unsignedToken, _keyBytes));

        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(parts[2]),
            Encoding.UTF8.GetBytes(expectedSignature)))
        {
            return new JwtValidationResult(JwtValidationStatus.Invalid);
        }

        var payloadBytes = Base64UrlDecode(parts[1]);
        if (payloadBytes is null)
        {
            return new JwtValidationResult(JwtValidationStatus.Invalid);
        }

        try
        {
            using var doc = JsonDocument.Parse(payloadBytes);
            var root = doc.RootElement;

            if (!root.TryGetProperty("exp", out var expProp) || !expProp.TryGetInt64(out var expUnix))
            {
                return new JwtValidationResult(JwtValidationStatus.Invalid);
            }

            var nowUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (nowUnix >= expUnix)
            {
                return new JwtValidationResult(JwtValidationStatus.Expired);
            }

            Guid? memberId = null;
            if (root.TryGetProperty("sub", out var subProp)
                && Guid.TryParse(subProp.GetString(), out var parsedId))
            {
                memberId = parsedId;
            }

            var email = root.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
            var name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;

            return new JwtValidationResult(JwtValidationStatus.Valid, memberId, email, name);
        }
        catch
        {
            return new JwtValidationResult(JwtValidationStatus.Invalid);
        }
    }

    private static byte[] ComputeHmacSha256(string data, byte[] key)
    {
        using var hmac = new HMACSHA256(key);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static byte[]? Base64UrlDecode(string input)
    {
        var output = input.Replace('-', '+').Replace('_', '/');
        switch (output.Length % 4)
        {
            case 2: output += "=="; break;
            case 3: output += "="; break;
        }

        try
        {
            return Convert.FromBase64String(output);
        }
        catch
        {
            return null;
        }
    }
}
