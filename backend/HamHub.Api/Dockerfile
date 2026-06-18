FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY backend/HamHub.Domain/HamHub.Domain.csproj backend/HamHub.Domain/
COPY backend/HamHub.Application/HamHub.Application.csproj backend/HamHub.Application/
COPY backend/HamHub.Infrastructure/HamHub.Infrastructure.csproj backend/HamHub.Infrastructure/
COPY backend/HamHub.Api/HamHub.Api.csproj backend/HamHub.Api/
RUN dotnet restore backend/HamHub.Api/HamHub.Api.csproj

COPY backend/ backend/
RUN dotnet publish backend/HamHub.Api/HamHub.Api.csproj \
    --configuration Release \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
RUN mkdir -p /app/wwwroot/uploads/listings /app/wwwroot/uploads/posts /app/wwwroot/uploads/stations
ENTRYPOINT ["dotnet", "HamHub.Api.dll"]
