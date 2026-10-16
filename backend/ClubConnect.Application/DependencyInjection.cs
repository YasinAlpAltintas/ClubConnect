using Microsoft.Extensions.DependencyInjection;
using ClubConnect.Application.Abstractions;
using ClubConnect.Application.Members;
using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application;

/// <summary>
/// Registers Application-layer services. <see cref="IMemberRepository"/> and
/// <see cref="IPasswordHasher"/> are infrastructure concerns and are expected
/// to be registered by the caller (the Infrastructure DI extension).
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<RegisterMemberUseCase>();
        return services;
    }
}
