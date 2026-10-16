using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace ClubConnect.Api.Tests;

public class RegisterEndpointTests : IClassFixture<ApiTestFixture>
{
    private const string RegisterUrl = "/api/auth/register";

    private readonly ApiTestFixture _fixture;

    public RegisterEndpointTests(ApiTestFixture fixture)
    {
        _fixture = fixture;
    }

    private static string UniqueEmail(string local = "member") =>
        $"{local}-{Guid.NewGuid():N}@example.com";

    [Fact]
    public async Task Health_ReturnsHealthy()
    {
        using var response = await _fixture.Client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Register_ValidPayload_ReturnsCreated_WithMemberIdAndCanonicalEmail()
    {
        var email = UniqueEmail();

        using var response = await _fixture.Client.PostAsJsonAsync(RegisterUrl, new
        {
            email = "  " + email.ToUpperInvariant() + "  ",
            password = "Passw0rd",
            displayName = "  Ada  ",
        });
        var body = await response.Content.ReadAsByteArrayAsync();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        Guid.Parse(root.GetProperty("memberId").GetString());
        Assert.Equal(email, root.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Register_InvalidEmail_ReturnsBadRequest_WithErrorContract()
    {
        using var response = await _fixture.Client.PostAsJsonAsync(RegisterUrl, new
        {
            email = "not-an-email",
            password = "Passw0rd",
        });
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_input", payload.GetProperty("error").GetString());
        Assert.NotNull(payload.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Register_WeakPassword_ReturnsBadRequest_WithSpecificDetail()
    {
        using var response = await _fixture.Client.PostAsJsonAsync(RegisterUrl, new
        {
            email = UniqueEmail(),
            password = "12345678",
        });
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_input", payload.GetProperty("error").GetString());
        Assert.Equal("Password must contain at least one letter.", payload.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Register_DuplicateEmail_ReturnsConflict()
    {
        var email = UniqueEmail();
        var payload = new { email, password = "Passw0rd" };

        using var first = await _fixture.Client.PostAsJsonAsync(RegisterUrl, payload);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        using var second = await _fixture.Client.PostAsJsonAsync(RegisterUrl, payload);
        var body = await second.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("email_conflict", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Register_MissingFields_ReturnsBadRequest()
    {
        using var response = await _fixture.Client.PostAsJsonAsync(RegisterUrl, new { });
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_input", payload.GetProperty("error").GetString());
        Assert.True(payload.TryGetProperty("detail", out _));
    }
}
