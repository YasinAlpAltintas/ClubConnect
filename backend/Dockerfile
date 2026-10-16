# Build ASP.NET Core application
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

# Copy solution and project sources
COPY . .

# Restore and publish
RUN dotnet restore ClubConnect.Api/ClubConnect.Api.csproj

RUN dotnet publish \
    ClubConnect.Api/ClubConnect.Api.csproj \
    -c Release \
    --no-restore \
    -o /app/publish \
    /p:UseAppHost=false

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish .

EXPOSE 8080

USER $APP_UID

ENTRYPOINT ["dotnet", "ClubConnect.Api.dll"]
