using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace ClubConnect.Api.Tests;

public class LoginEndpointTests : IClassFixture<ApiTestFixture>
{
    private const string RegisterUrl = "/api/auth/register";
    private const string LoginUrl = "/api/auth/login";

    private readonly ApiTestFixture _fixture;

    public LoginEndpointTests(ApiTestFixture fixture)
    {
        _fixture = fixture;
    }

    private static string UniqueEmail(string local = "login-member") =>
        $"{local}-{Guid.NewGuid():N}@example.com";

    [Fact]
    public async Task Login_ValidCredentials_ReturnsOk_WithMemberProfile()
    {
        var email = UniqueEmail();
        const string password = "ValidPass123";

        // Register member first
        var regResponse = await _fixture.Client.PostAsJsonAsync(RegisterUrl, new
        {
            email,
            password,
            displayName = "Ada Lovelace"
        });
        Assert.Equal(HttpStatusCode.Created, regResponse.StatusCode);
        var regBody = await regResponse.Content.ReadFromJsonAsync<JsonElement>();
        var registeredMemberId = regBody.GetProperty("memberId").GetString();

        // Perform login
        using var loginResponse = await _fixture.Client.PostAsJsonAsync(LoginUrl, new
        {
            email,
            password
        });

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var loginBody = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(registeredMemberId, loginBody.GetProperty("memberId").GetString());
        Assert.Equal(email, loginBody.GetProperty("email").GetString());
        Assert.Equal("Ada Lovelace", loginBody.GetProperty("displayName").GetString());
        Assert.True(loginBody.TryGetProperty("token", out var tokenProp) && !string.IsNullOrWhiteSpace(tokenProp.GetString()));
    }

    [Fact]
    public async Task Login_CaseInsensitiveEmail_ReturnsOk()
    {
        var email = UniqueEmail();
        const string password = "ValidPass123";

        await _fixture.Client.PostAsJsonAsync(RegisterUrl, new
        {
            email,
            password,
            displayName = "Test User"
        });

        using var loginResponse = await _fixture.Client.PostAsJsonAsync(LoginUrl, new
        {
            email = "  " + email.ToUpperInvariant() + "  ",
            password
        });

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var body = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(email, body.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Login_InvalidEmailFormat_ReturnsBadRequest()
    {
        using var response = await _fixture.Client.PostAsJsonAsync(LoginUrl, new
        {
            email = "invalid-email-format",
            password = "ValidPass123"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("invalid_input", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Login_EmptyPassword_ReturnsBadRequest()
    {
        using var response = await _fixture.Client.PostAsJsonAsync(LoginUrl, new
        {
            email = UniqueEmail(),
            password = ""
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("invalid_input", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Login_UnknownMember_ReturnsUnauthorized()
    {
        using var response = await _fixture.Client.PostAsJsonAsync(LoginUrl, new
        {
            email = UniqueEmail("nonexistent"),
            password = "SomePassword123!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("invalid_credentials", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsUnauthorized()
    {
        var email = UniqueEmail();
        const string correctPassword = "ValidPass123";

        await _fixture.Client.PostAsJsonAsync(RegisterUrl, new
        {
            email,
            password = correctPassword
        });

        using var response = await _fixture.Client.PostAsJsonAsync(LoginUrl, new
        {
            email,
            password = "WrongPassword999"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("invalid_credentials", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task GetProfile_WithValidToken_ReturnsMemberProfile()
    {
        var email = UniqueEmail();
        const string password = "ValidPass123";

        await _fixture.Client.PostAsJsonAsync(RegisterUrl, new
        {
            email,
            password,
            displayName = "Token User"
        });

        using var loginResponse = await _fixture.Client.PostAsJsonAsync(LoginUrl, new
        {
            email,
            password
        });
        var loginBody = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        var token = loginBody.GetProperty("token").GetString();

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        using var profileResponse = await _fixture.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, profileResponse.StatusCode);
        var profileBody = await profileResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(email, profileBody.GetProperty("email").GetString());
        Assert.Equal("Token User", profileBody.GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task GetProfile_WithExpiredToken_ReturnsUnauthorized()
    {
        var jwtService = new Infrastructure.Security.JwtTokenService(Infrastructure.Security.JwtTokenService.DefaultSecretKey);
        var member = new Domain.Entities.Member
        {
            Id = Guid.NewGuid(),
            Email = "expired@example.com",
            PasswordHash = "hash",
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        var expiredToken = jwtService.GenerateToken(member, TimeSpan.FromSeconds(-30));

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", expiredToken);
        using var response = await _fixture.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("token_expired", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task CheckEmail_ReturnsAccurateAvailability()
    {
        var email = UniqueEmail();
        const string password = "ValidPass123";

        // Check before registration
        var res1 = await _fixture.Client.GetAsync($"/api/auth/check-email?email={email}");
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var body1 = await res1.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body1.GetProperty("exists").GetBoolean());

        // Register member
        await _fixture.Client.PostAsJsonAsync(RegisterUrl, new { email, password });

        // Check after registration
        var res2 = await _fixture.Client.GetAsync($"/api/auth/check-email?email={email}");
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
        var body2 = await res2.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body2.GetProperty("exists").GetBoolean());

        // Check invalid email format
        var res3 = await _fixture.Client.GetAsync("/api/auth/check-email?email=invalid-email");
        Assert.Equal(HttpStatusCode.BadRequest, res3.StatusCode);
    }
}

