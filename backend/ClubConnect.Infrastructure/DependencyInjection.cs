using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ClubConnect.Application.Abstractions;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Infrastructure.Persistence;
using ClubConnect.Infrastructure.Repositories;
using ClubConnect.Infrastructure.Security;

namespace ClubConnect.Infrastructure;

/// <summary>
/// Adds the Infrastructure layer to the service collection:
/// <ul>
///   <li>EF Core <see cref="ClubConnectDbContext"/> backed by Npgsql.</li>
///   <li><see cref="IMemberRepository"/> bound to <see cref="MemberRepository"/>.</li>
///   <li><see cref="IClubRepository"/> bound to <see cref="ClubRepository"/>.</li>
///   <li><see cref="IPasswordHasher"/> bound to <see cref="Argon2PasswordHasher"/>
///       (OWASP-minimum parameters; overridable via configuration).</li>
/// </ul>
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var section = configuration.GetSection("ClubConnect");

        var memorySizeKiB = section.GetValue<int?>("Password:MemorySizeKiB")
            ?? Argon2PasswordHasher.DefaultMemorySize;
        var iterations = section.GetValue<int?>("Password:Iterations")
            ?? Argon2PasswordHasher.DefaultIterations;
        var parallelism = section.GetValue<int?>("Password:Parallelism")
            ?? Argon2PasswordHasher.DefaultDegreeOfParallelism;

        services.AddSingleton<IPasswordHasher>(sp =>
            new Argon2PasswordHasher(memorySizeKiB, iterations, parallelism));

        services.AddSingleton<IJwtTokenService, JwtTokenService>();

        services.AddDbContext<ClubConnectDbContext>(options =>
        {
            var connectionString = section.GetConnectionString("Default")
                ?? configuration.GetConnectionString("Default");
            options.UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MigrationsAssembly(typeof(ClubConnectDbContext).Assembly);
            });
        });

        services.AddScoped<IMemberRepository, MemberRepository>();
        services.AddScoped<IClubRepository, ClubRepository>();

        return services;
    }
}
