using System.Threading.RateLimiting;
using ClubConnect.Application;
using ClubConnect.Application.Abstractions;
using ClubConnect.Infrastructure;
using ClubConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHealthChecks();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("invite-code-policy", httpContext =>
    {
        string partitionKey;
        var authHeader = httpContext.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = authHeader["Bearer ".Length..].Trim();
            var jwtService = httpContext.RequestServices.GetService<IJwtTokenService>();
            var validation = jwtService?.ValidateToken(token);
            partitionKey = validation?.MemberId?.ToString()
                ?? httpContext.Connection.RemoteIpAddress?.ToString()
                ?? "anonymous";
        }
        else
        {
            partitionKey = httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous";
        }

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });
});

var allowedOrigins = builder.Configuration
    .GetSection("ClubConnect:Cors:AllowedOrigins").Get<string[]>()
    ?? [];

builder.Services.AddCors(o => o.AddDefaultPolicy(policy =>
{
    if (allowedOrigins.Length > 0)
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
}));

var app = builder.Build();

if (args.Contains("--migrate"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<ClubConnectDbContext>();
    await db.Database.MigrateAsync();
    return;
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseHttpsRedirection();
app.UseRouting();
app.UseRateLimiter();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory-based integration tests.
public partial class Program { }
