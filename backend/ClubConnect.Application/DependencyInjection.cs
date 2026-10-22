using Microsoft.Extensions.DependencyInjection;
using ClubConnect.Application.Abstractions;
using ClubConnect.Application.Clubs;
using ClubConnect.Application.Members;
using ClubConnect.Domain.Abstractions;

namespace ClubConnect.Application;

/// <summary>
/// Registers Application-layer services.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<RegisterMemberUseCase>();
        services.AddScoped<LoginMemberUseCase>();
        services.AddScoped<CreateClubUseCase>();
        services.AddScoped<JoinClubUseCase>();
        return services;
    }
}
