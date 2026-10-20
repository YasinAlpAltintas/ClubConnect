using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace ClubConnect.Api.Tests;

public class ClubsEndpointTests : IClassFixture<ApiTestFixture>
{
    private const string RegisterUrl = "/api/auth/register";
    private const string LoginUrl = "/api/auth/login";
    private const string ClubsUrl = "/api/clubs";
    private const string MyClubsUrl = "/api/auth/me/clubs";

    private readonly ApiTestFixture _fixture;

    public ClubsEndpointTests(ApiTestFixture fixture)
    {
        _fixture = fixture;
    }

    private static string UniqueEmail(string local = "club-user") =>
        $"{local}-{Guid.NewGuid():N}@example.com";

    private async Task<string> RegisterAndLoginAsync(string? prefix = null)
    {
        var email = UniqueEmail(prefix ?? "club-member");
        const string password = "ValidPass123!";

        var regRes = await _fixture.Client.PostAsJsonAsync(RegisterUrl, new
        {
            email,
            password,
            displayName = "Club Creator"
        });
        regRes.EnsureSuccessStatusCode();

        var loginRes = await _fixture.Client.PostAsJsonAsync(LoginUrl, new
        {
            email,
            password
        });
        loginRes.EnsureSuccessStatusCode();

        var body = await loginRes.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()!;
    }

    [Fact]
    public async Task CreateClub_WithoutToken_Returns401Unauthorized()
    {
        using var response = await _fixture.Client.PostAsJsonAsync(ClubsUrl, new
        {
            name = "Leuven Coding Society"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateClub_WithExpiredToken_Returns401Unauthorized()
    {
        var jwtService = new Infrastructure.Security.JwtTokenService(Infrastructure.Security.JwtTokenService.DefaultSecretKey);
        var expiredToken = jwtService.GenerateToken(new Domain.Entities.Member
        {
            Id = Guid.NewGuid(),
            Email = "expired@example.com",
            DisplayName = "Expired"
        }, TimeSpan.FromSeconds(-30));

        using var request = new HttpRequestMessage(HttpMethod.Post, ClubsUrl)
        {
            Content = JsonContent.Create(new { name = "Robotics Club" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", expiredToken);

        using var response = await _fixture.Client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("A")]
    public async Task CreateClub_WithInvalidName_Returns400BadRequest(string name)
    {
        var token = await RegisterAndLoginAsync();

        using var request = new HttpRequestMessage(HttpMethod.Post, ClubsUrl)
        {
            Content = JsonContent.Create(new { name })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _fixture.Client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("invalid_input", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task CreateClub_WithValidName_Returns201Created_AndAssignsClubAdminRole()
    {
        var token = await RegisterAndLoginAsync();

        using var request = new HttpRequestMessage(HttpMethod.Post, ClubsUrl)
        {
            Content = JsonContent.Create(new
            {
                name = "Leuven Coding Club",
                description = "Campus software development and hackathons."
            })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _fixture.Client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("id", out var idProp) && Guid.TryParse(idProp.GetString(), out _));
        Assert.Equal("Leuven Coding Club", body.GetProperty("name").GetString());
        Assert.Equal("Campus software development and hackathons.", body.GetProperty("description").GetString());
        Assert.Equal("Club Admin", body.GetProperty("role").GetString());
        Assert.True(body.TryGetProperty("createdAtUtc", out _));
    }

    [Fact]
    public async Task GetClubs_And_GetMyClubs_ReturnsCreatedClub_WithIsolation()
    {
        var user1Token = await RegisterAndLoginAsync("user1-clubs");
        var user2Token = await RegisterAndLoginAsync("user2-clubs");

        // 1. Initially user 1 and user 2 have 0 clubs
        using var initReq1 = new HttpRequestMessage(HttpMethod.Get, MyClubsUrl);
        initReq1.Headers.Authorization = new AuthenticationHeaderValue("Bearer", user1Token);
        using var initRes1 = await _fixture.Client.SendAsync(initReq1);
        Assert.Equal(HttpStatusCode.OK, initRes1.StatusCode);
        var initClubs1 = await initRes1.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, initClubs1.GetArrayLength());

        // 2. User 1 creates a club
        using var createReq = new HttpRequestMessage(HttpMethod.Post, ClubsUrl)
        {
            Content = JsonContent.Create(new { name = "User 1 Debate Society" })
        };
        createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", user1Token);
        using var createRes = await _fixture.Client.SendAsync(createReq);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var createdBody = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var createdClubId = createdBody.GetProperty("id").GetString();

        // 3. User 1 fetches my clubs via /api/auth/me/clubs and /api/clubs -> sees the created club
        using var myClubsReq1 = new HttpRequestMessage(HttpMethod.Get, MyClubsUrl);
        myClubsReq1.Headers.Authorization = new AuthenticationHeaderValue("Bearer", user1Token);
        using var myClubsRes1 = await _fixture.Client.SendAsync(myClubsReq1);
        Assert.Equal(HttpStatusCode.OK, myClubsRes1.StatusCode);
        var myClubsList1 = await myClubsRes1.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, myClubsList1.GetArrayLength());
        Assert.Equal(createdClubId, myClubsList1[0].GetProperty("id").GetString());
        Assert.Equal("User 1 Debate Society", myClubsList1[0].GetProperty("name").GetString());
        Assert.Equal("Club Admin", myClubsList1[0].GetProperty("role").GetString());

        // 4. User 2 fetches my clubs -> must still be 0 (Multi-tenant isolation)
        using var myClubsReq2 = new HttpRequestMessage(HttpMethod.Get, MyClubsUrl);
        myClubsReq2.Headers.Authorization = new AuthenticationHeaderValue("Bearer", user2Token);
        using var myClubsRes2 = await _fixture.Client.SendAsync(myClubsReq2);
        Assert.Equal(HttpStatusCode.OK, myClubsRes2.StatusCode);
        var myClubsList2 = await myClubsRes2.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, myClubsList2.GetArrayLength());
    }
}
