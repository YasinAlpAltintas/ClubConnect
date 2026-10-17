using ClubConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ClubConnect.Api.Tests;

/// <summary>
/// Shared host for integration tests: the real DI pipeline (Application +
/// Infrastructure) with the EF Core provider swapped for InMemory so no
/// Postgres is required, and the environment pinned to Production so
/// <c>EnsureCreatedAsync</c> and OpenAPI mapping are skipped.
/// </summary>
public sealed class ApiTestFixture : IDisposable
{
    private const string InMemoryDbName = "api-tests-ef-memory";

    private readonly WebApplicationFactory<Program> _factory;

    public ApiTestFixture()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Production");

                builder.ConfigureTestServices(services =>
                {
                    // Remove every DI descriptor whose ServiceType transitively
                    // references ClubConnectDbContext. This covers the DbContext
                    // itself, the internal options registrations, and – crucially
                    // – the IConfigureOptions<DbContextOptions<T>> closures that
                    // hold the UseNpgsql(…) call. Without that last removal, EF
                    // Core would apply both the Npgsql and the InMemory provider
                    // extensions and refuse to construct the context.
                    static bool Involves(Type t)
                    {
                        if (t == typeof(ClubConnectDbContext)) return true;
                        if (t.IsGenericType)
                            foreach (var arg in t.GetGenericArguments())
                                if (Involves(arg)) return true;
                        return false;
                    }

                    for (var i = services.Count - 1; i >= 0; i--)
                    {
                        if (Involves(services[i].ServiceType))
                            services.RemoveAt(i);
                    }

                    services.AddDbContext<ClubConnectDbContext>(options =>
                        options.UseInMemoryDatabase(InMemoryDbName));
                });
            });
    }

    public HttpClient Client => _factory.CreateClient();

    public void Dispose() => _factory.Dispose();
}
