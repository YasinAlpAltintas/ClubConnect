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
    private const string JoinClubUrl = "/api/clubs/join";
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
        Assert.True(body.TryGetProperty("inviteCode", out var codeProp));
        Assert.Matches(@"^\d{6}$", codeProp.GetString());
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

    [Fact]
    public async Task JoinClub_WithoutToken_Returns401Unauthorized()
    {
        using var response = await _fixture.Client.PostAsJsonAsync(JoinClubUrl, new
        {
            code = "123456"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task JoinClub_WithExpiredToken_Returns401Unauthorized()
    {
        var jwtService = new Infrastructure.Security.JwtTokenService(Infrastructure.Security.JwtTokenService.DefaultSecretKey);
        var expiredToken = jwtService.GenerateToken(new Domain.Entities.Member
        {
            Id = Guid.NewGuid(),
            Email = "expired-joiner@example.com",
            DisplayName = "Expired Joiner"
        }, TimeSpan.FromSeconds(-30));

        using var request = new HttpRequestMessage(HttpMethod.Post, JoinClubUrl)
        {
            Content = JsonContent.Create(new { code = "123456" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", expiredToken);

        using var response = await _fixture.Client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("12345")] // 5 digits
    [InlineData("1234567")] // 7 digits
    [InlineData("abcdef")] // letters
    public async Task JoinClub_WithInvalidCodeFormat_Returns400BadRequest(string code)
    {
        var token = await RegisterAndLoginAsync("join-fmt");

        using var request = new HttpRequestMessage(HttpMethod.Post, JoinClubUrl)
        {
            Content = JsonContent.Create(new { code })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _fixture.Client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("invalid_input", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task JoinClub_WithUnknownCode_Returns404NotFound()
    {
        var token = await RegisterAndLoginAsync("join-notfound");

        using var request = new HttpRequestMessage(HttpMethod.Post, JoinClubUrl)
        {
            Content = JsonContent.Create(new { code = "999999" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _fixture.Client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("invalid_code", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task JoinClub_WithValidCode_Returns200OK_AssignsClubMemberRole_AndReflectsInMyClubs()
    {
        var creatorToken = await RegisterAndLoginAsync("creator-flow");
        var joinerToken = await RegisterAndLoginAsync("joiner-flow");

        // 1. Creator creates a club
        using var createReq = new HttpRequestMessage(HttpMethod.Post, ClubsUrl)
        {
            Content = JsonContent.Create(new
            {
                name = "Leuven Robotics Guild",
                description = "Autonomous robotics and hardware prototyping."
            })
        };
        createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", creatorToken);
        using var createRes = await _fixture.Client.SendAsync(createReq);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var createdClub = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var inviteCode = createdClub.GetProperty("inviteCode").GetString();
        var clubId = createdClub.GetProperty("id").GetString();
        Assert.NotNull(inviteCode);
        Assert.Matches(@"^\d{6}$", inviteCode);

        // 2. Joiner joins the club using the invite code
        using var joinReq = new HttpRequestMessage(HttpMethod.Post, JoinClubUrl)
        {
            Content = JsonContent.Create(new { code = inviteCode })
        };
        joinReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", joinerToken);
        using var joinRes = await _fixture.Client.SendAsync(joinReq);
        Assert.Equal(HttpStatusCode.OK, joinRes.StatusCode);

        var joinBody = await joinRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(clubId, joinBody.GetProperty("clubId").GetString());
        Assert.Equal("Leuven Robotics Guild", joinBody.GetProperty("name").GetString());
        Assert.Equal("Autonomous robotics and hardware prototyping.", joinBody.GetProperty("description").GetString());
        Assert.Equal("Club Member", joinBody.GetProperty("role").GetString());
        Assert.True(joinBody.TryGetProperty("joinedAtUtc", out _));

        // 3. Joiner fetches my clubs -> sees the joined club as "Club Member" (with null inviteCode)
        using var joinerClubsReq = new HttpRequestMessage(HttpMethod.Get, MyClubsUrl);
        joinerClubsReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", joinerToken);
        using var joinerClubsRes = await _fixture.Client.SendAsync(joinerClubsReq);
        Assert.Equal(HttpStatusCode.OK, joinerClubsRes.StatusCode);
        var joinerClubs = await joinerClubsRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, joinerClubs.GetArrayLength());
        Assert.Equal(clubId, joinerClubs[0].GetProperty("id").GetString());
        Assert.Equal("Leuven Robotics Guild", joinerClubs[0].GetProperty("name").GetString());
        Assert.Equal("Club Member", joinerClubs[0].GetProperty("role").GetString());
        Assert.True(joinerClubs[0].GetProperty("inviteCode").ValueKind == JsonValueKind.Null);

        // 4. Creator fetches my clubs -> sees the club as "Club Admin" with active inviteCode
        using var creatorClubsReq = new HttpRequestMessage(HttpMethod.Get, MyClubsUrl);
        creatorClubsReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", creatorToken);
        using var creatorClubsRes = await _fixture.Client.SendAsync(creatorClubsReq);
        Assert.Equal(HttpStatusCode.OK, creatorClubsRes.StatusCode);
        var creatorClubs = await creatorClubsRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, creatorClubs.GetArrayLength());
        Assert.Equal(clubId, creatorClubs[0].GetProperty("id").GetString());
        Assert.Equal("Club Admin", creatorClubs[0].GetProperty("role").GetString());
        Assert.Equal(inviteCode, creatorClubs[0].GetProperty("inviteCode").GetString());
    }

    [Fact]
    public async Task JoinClub_AlreadyMember_Returns409Conflict()
    {
        var creatorToken = await RegisterAndLoginAsync("creator-dup");
        var joinerToken = await RegisterAndLoginAsync("joiner-dup");

        // 1. Creator creates a club
        using var createReq = new HttpRequestMessage(HttpMethod.Post, ClubsUrl)
        {
            Content = JsonContent.Create(new { name = "Duplicate Join Club" })
        };
        createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", creatorToken);
        using var createRes = await _fixture.Client.SendAsync(createReq);
        var createdClub = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var inviteCode = createdClub.GetProperty("inviteCode").GetString()!;

        // 2. Joiner joins the club first time
        using var joinReq1 = new HttpRequestMessage(HttpMethod.Post, JoinClubUrl)
        {
            Content = JsonContent.Create(new { code = inviteCode })
        };
        joinReq1.Headers.Authorization = new AuthenticationHeaderValue("Bearer", joinerToken);
        using var joinRes1 = await _fixture.Client.SendAsync(joinReq1);
        Assert.Equal(HttpStatusCode.OK, joinRes1.StatusCode);

        // 3. Joiner tries to join the exact same club a second time
        using var joinReq2 = new HttpRequestMessage(HttpMethod.Post, JoinClubUrl)
        {
            Content = JsonContent.Create(new { code = inviteCode })
        };
        joinReq2.Headers.Authorization = new AuthenticationHeaderValue("Bearer", joinerToken);
        using var joinRes2 = await _fixture.Client.SendAsync(joinReq2);
        Assert.Equal(HttpStatusCode.Conflict, joinRes2.StatusCode);

        var conflictBody = await joinRes2.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("already_member", conflictBody.GetProperty("error").GetString());
    }

    [Fact]
    public async Task JoinClub_RateLimiter_Returns429TooManyRequests_AfterExceedingLimit()
    {
        var token = await RegisterAndLoginAsync("ratelimit-user");

        // Send 5 requests (the permit limit)
        for (var i = 0; i < 5; i++)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, JoinClubUrl)
            {
                Content = JsonContent.Create(new { code = "000000" })
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var res = await _fixture.Client.SendAsync(req);
            // First 5 attempts return 404 (or 400), but NOT 429
            Assert.NotEqual(HttpStatusCode.TooManyRequests, res.StatusCode);
        }

        // 6th request from the exact same user must be rejected with 429 Too Many Requests
        using var req6 = new HttpRequestMessage(HttpMethod.Post, JoinClubUrl)
        {
            Content = JsonContent.Create(new { code = "000000" })
        };
        req6.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var res6 = await _fixture.Client.SendAsync(req6);

        Assert.Equal(HttpStatusCode.TooManyRequests, res6.StatusCode);
    }

    [Fact]
    public async Task GetClubById_WithoutToken_Returns401Unauthorized()
    {
        var randomClubId = Guid.NewGuid();
        using var response = await _fixture.Client.GetAsync($"{ClubsUrl}/{randomClubId}");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetClubById_WithExpiredToken_Returns401Unauthorized()
    {
        var jwtService = new Infrastructure.Security.JwtTokenService(Infrastructure.Security.JwtTokenService.DefaultSecretKey);
        var expiredToken = jwtService.GenerateToken(new Domain.Entities.Member
        {
            Id = Guid.NewGuid(),
            Email = "expired-club-reader@example.com",
            DisplayName = "Expired Reader"
        }, TimeSpan.FromSeconds(-30));

        var randomClubId = Guid.NewGuid();
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{ClubsUrl}/{randomClubId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", expiredToken);

        using var response = await _fixture.Client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetClubById_WithNonExistentClub_Returns404NotFound()
    {
        var token = await RegisterAndLoginAsync("reader-notfound");
        var nonExistentId = Guid.NewGuid();

        using var request = new HttpRequestMessage(HttpMethod.Get, $"{ClubsUrl}/{nonExistentId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _fixture.Client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("not_found", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task GetClubById_WhenUserNotMember_Returns403Forbidden()
    {
        var adminToken = await RegisterAndLoginAsync("admin-owner");
        var outsiderToken = await RegisterAndLoginAsync("outsider-user");

        // Admin creates a club
        using var createReq = new HttpRequestMessage(HttpMethod.Post, ClubsUrl)
        {
            Content = JsonContent.Create(new { name = "Private Members Society" })
        };
        createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        using var createRes = await _fixture.Client.SendAsync(createReq);
        var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var clubId = created.GetProperty("id").GetString();

        // Outsider attempts to fetch the club details
        using var getReq = new HttpRequestMessage(HttpMethod.Get, $"{ClubsUrl}/{clubId}");
        getReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", outsiderToken);
        using var getRes = await _fixture.Client.SendAsync(getReq);

        Assert.Equal(HttpStatusCode.Forbidden, getRes.StatusCode);
        var body = await getRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("forbidden", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task GetClubById_WhenUserIsAdmin_Returns200OK_WithInviteCode()
    {
        var adminToken = await RegisterAndLoginAsync("admin-checker");

        // 1. Admin creates a club
        using var createReq = new HttpRequestMessage(HttpMethod.Post, ClubsUrl)
        {
            Content = JsonContent.Create(new
            {
                name = "Leuven Robotics Team",
                description = "Robotics and hardware building."
            })
        };
        createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        using var createRes = await _fixture.Client.SendAsync(createReq);
        var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var clubId = created.GetProperty("id").GetString();
        var inviteCode = created.GetProperty("inviteCode").GetString();

        // 2. Admin retrieves club by ID
        using var getReq = new HttpRequestMessage(HttpMethod.Get, $"{ClubsUrl}/{clubId}");
        getReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        using var getRes = await _fixture.Client.SendAsync(getReq);

        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var detail = await getRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(clubId, detail.GetProperty("id").GetString());
        Assert.Equal("Leuven Robotics Team", detail.GetProperty("name").GetString());
        Assert.Equal("Robotics and hardware building.", detail.GetProperty("description").GetString());
        Assert.Equal("Club Admin", detail.GetProperty("role").GetString());
        Assert.Equal(inviteCode, detail.GetProperty("inviteCode").GetString());
    }

    [Fact]
    public async Task GetClubById_WhenUserIsMember_Returns200OK_WithNullInviteCode()
    {
        var adminToken = await RegisterAndLoginAsync("admin-inviter");
        var memberToken = await RegisterAndLoginAsync("member-joined");

        // 1. Admin creates club
        using var createReq = new HttpRequestMessage(HttpMethod.Post, ClubsUrl)
        {
            Content = JsonContent.Create(new { name = "Astronomy Club" })
        };
        createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        using var createRes = await _fixture.Client.SendAsync(createReq);
        var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var clubId = created.GetProperty("id").GetString();
        var inviteCode = created.GetProperty("inviteCode").GetString();

        // 2. Member joins club
        using var joinReq = new HttpRequestMessage(HttpMethod.Post, JoinClubUrl)
        {
            Content = JsonContent.Create(new { code = inviteCode })
        };
        joinReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        using var joinRes = await _fixture.Client.SendAsync(joinReq);
        Assert.Equal(HttpStatusCode.OK, joinRes.StatusCode);

        // 3. Member retrieves club details by ID
        using var getReq = new HttpRequestMessage(HttpMethod.Get, $"{ClubsUrl}/{clubId}");
        getReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        using var getRes = await _fixture.Client.SendAsync(getReq);

        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var detail = await getRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(clubId, detail.GetProperty("id").GetString());
        Assert.Equal("Astronomy Club", detail.GetProperty("name").GetString());
        Assert.Equal("Club Member", detail.GetProperty("role").GetString());
        Assert.True(detail.GetProperty("inviteCode").ValueKind == JsonValueKind.Null);
    }
}
