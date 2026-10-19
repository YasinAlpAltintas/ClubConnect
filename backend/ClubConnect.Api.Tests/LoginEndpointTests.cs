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
}
