using ClubConnect.Application;
using ClubConnect.Infrastructure;
using ClubConnect.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHealthChecks();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var allowedOrigins = builder.Configuration
    .GetSection("ClubConnect:Cors:AllowedOrigins").Get<string[]>()
    ?? [];

builder.Services.AddCors(o => o.AddDefaultPolicy(policy =>
{
    if (allowedOrigins.Length > 0)
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
}));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // No EF Core migrations are committed yet. For this local vertical slice we
    // create the schema on startup; real migrations ship with a later story.
    var db = app.Services.GetRequiredService<ClubConnectDbContext>();
    await db.Database.EnsureCreatedAsync();
}

app.UseCors();
app.UseHttpsRedirection();
app.UseRouting();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory-based integration tests.
public partial class Program { }
