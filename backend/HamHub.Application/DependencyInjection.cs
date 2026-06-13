using HamHub.Application.Common.Mappings;
using Microsoft.Extensions.DependencyInjection;

namespace HamHub.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddAutoMapper(typeof(MappingProfile).Assembly);
        return services;
    }
}
