using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ClubConnect.Domain.Entities;
using ClubConnect.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ClubConnect.Api.Tests;

/// <summary>
/// Integration tests for <c>GET /api/clubs/{id}/tasks</c> (INC-27 Kanban board).
/// Tasks are seeded directly in the database because task creation is a later story (INC-37).
/// </summary>
public class ClubTasksEndpointTests : IClassFixture<ApiTestFixture>
{
    private const string RegisterUrl = "/api/auth/register";
    private const string LoginUrl = "/api/auth/login";
    private const string ClubsUrl = "/api/clubs";
    private const string JoinClubUrl = "/api/clubs/join";

    private readonly ApiTestFixture _fixture;

    public ClubTasksEndpointTests(ApiTestFixture fixture)
    {
        _fixture = fixture;
    }

    private sealed record TestMember(Guid Id, string Email, string DisplayName, string Token);

    private async Task<TestMember> RegisterAndLoginAsync(string prefix)
    {
        var email = $"{prefix}-{Guid.NewGuid():N}@example.com";
        const string password = "ValidPass123!";

        var regRes = await _fixture.Client.PostAsJsonAsync(RegisterUrl, new { email, password });
        regRes.EnsureSuccessStatusCode();

        var loginRes = await _fixture.Client.PostAsJsonAsync(LoginUrl, new { email, password });
        loginRes.EnsureSuccessStatusCode();

        var body = await loginRes.Content.ReadFromJsonAsync<JsonElement>();
        return new TestMember(
            Guid.Parse(body.GetProperty("memberId").GetString()!),
            body.GetProperty("email").GetString()!,
            body.GetProperty("displayName").GetString() ?? string.Empty,
            body.GetProperty("token").GetString()!);
    }

    private async Task<(Guid ClubId, string InviteCode)> CreateClubAsync(string token, string name)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, ClubsUrl)
        {
            Content = JsonContent.Create(new { name })
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var res = await _fixture.Client.SendAsync(req);
        res.EnsureSuccessStatusCode();

        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return (Guid.Parse(body.GetProperty("id").GetString()!), body.GetProperty("inviteCode").GetString()!);
    }

    private async Task SeedTasksAsync(params ClubTask[] tasks)
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClubConnectDbContext>();
        db.Tasks.AddRange(tasks);
        await db.SaveChangesAsync();
    }

    private async Task<HttpResponseMessage> GetTasksAsync(Guid clubId, string? token)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{ClubsUrl}/{clubId}/tasks");
        if (token is not null)
        {
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        return await _fixture.Client.SendAsync(req);
    }

    [Fact]
    public async Task GetClubTasks_WithoutToken_Returns401Unauthorized()
    {
        using var res = await GetTasksAsync(Guid.NewGuid(), token: null);

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task GetClubTasks_WhenClubDoesNotExist_Returns404NotFound()
    {
        var user = await RegisterAndLoginAsync("tasks-404");

        using var res = await GetTasksAsync(Guid.NewGuid(), user.Token);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task GetClubTasks_WhenClubHasNoTasks_Returns200OK_WithEmptyList()
    {
        var admin = await RegisterAndLoginAsync("tasks-empty");
        var (clubId, _) = await CreateClubAsync(admin.Token, "Empty Board Club");

        using var res = await GetTasksAsync(clubId, admin.Token);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var tasks = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, tasks.GetArrayLength());
    }

    [Fact]
    public async Task GetClubTasks_WhenUserIsMember_ReturnsTasksWithStatusAndAssignee()
    {
        var admin = await RegisterAndLoginAsync("tasks-admin");
        var member = await RegisterAndLoginAsync("tasks-member");
        var (clubId, inviteCode) = await CreateClubAsync(admin.Token, "Board Game Club");

        using (var joinReq = new HttpRequestMessage(HttpMethod.Post, JoinClubUrl)
        {
            Content = JsonContent.Create(new { code = inviteCode })
        })
        {
            joinReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", member.Token);
            using var joinRes = await _fixture.Client.SendAsync(joinReq);
            Assert.Equal(HttpStatusCode.OK, joinRes.StatusCode);
        }

        var now = DateTimeOffset.UtcNow;
        await SeedTasksAsync(
            new ClubTask
            {
                ClubId = clubId,
                Title = "Book the hall",
                Description = "Reserve the main hall for Friday",
                Status = ClubTaskStatus.ToDo,
                AssigneeMemberId = admin.Id,
                CreatedByMemberId = admin.Id,
                CreatedAtUtc = now.AddMinutes(-3)
            },
            new ClubTask
            {
                ClubId = clubId,
                Title = "Order new boards",
                Status = ClubTaskStatus.InProgress,
                CreatedByMemberId = admin.Id,
                CreatedAtUtc = now.AddMinutes(-2)
            },
            new ClubTask
            {
                ClubId = clubId,
                Title = "Send newsletter",
                Status = ClubTaskStatus.Done,
                CreatedByMemberId = admin.Id,
                CreatedAtUtc = now.AddMinutes(-1)
            });

        using var res = await GetTasksAsync(clubId, member.Token);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var tasks = (await res.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.Equal(3, tasks.Count);

        var todo = tasks[0];
        Assert.Equal("Book the hall", todo.GetProperty("title").GetString());
        Assert.Equal("Reserve the main hall for Friday", todo.GetProperty("description").GetString());
        Assert.Equal("todo", todo.GetProperty("status").GetString());
        Assert.Equal(admin.Id.ToString(), todo.GetProperty("assigneeMemberId").GetString());
        var expectedName = string.IsNullOrWhiteSpace(admin.DisplayName) ? admin.Email : admin.DisplayName;
        Assert.Equal(expectedName, todo.GetProperty("assigneeDisplayName").GetString());

        var inProgress = tasks[1];
        Assert.Equal("in_progress", inProgress.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, inProgress.GetProperty("assigneeMemberId").ValueKind);
        Assert.Equal(JsonValueKind.Null, inProgress.GetProperty("assigneeDisplayName").ValueKind);

        Assert.Equal("done", tasks[2].GetProperty("status").GetString());
    }

    [Fact]
    public async Task GetClubTasks_IsolatesTenants_AndForbidsNonMembers()
    {
        var adminA = await RegisterAndLoginAsync("tasks-tenant-a");
        var adminB = await RegisterAndLoginAsync("tasks-tenant-b");
        var (clubA, _) = await CreateClubAsync(adminA.Token, "Club A");
        var (clubB, _) = await CreateClubAsync(adminB.Token, "Club B");

        await SeedTasksAsync(
            new ClubTask { ClubId = clubA, Title = "A-T1", CreatedByMemberId = adminA.Id },
            new ClubTask { ClubId = clubB, Title = "B-T1", CreatedByMemberId = adminB.Id });

        // A sees only its own task.
        using var ownRes = await GetTasksAsync(clubA, adminA.Token);
        Assert.Equal(HttpStatusCode.OK, ownRes.StatusCode);
        var ownTasks = (await ownRes.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.Single(ownTasks);
        Assert.Equal("A-T1", ownTasks[0].GetProperty("title").GetString());

        // A requesting club B's board is denied without leaking B's tasks.
        using var crossRes = await GetTasksAsync(clubB, adminA.Token);
        Assert.Equal(HttpStatusCode.Forbidden, crossRes.StatusCode);
        var crossBody = await crossRes.Content.ReadAsStringAsync();
        Assert.DoesNotContain("B-T1", crossBody);
    }
}
