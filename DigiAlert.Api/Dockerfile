# Compilation
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["DigiAlert.Api.csproj", "./"]
RUN dotnet restore "DigiAlert.Api.csproj"
COPY . .
RUN dotnet publish "DigiAlert.Api.csproj" -c Release -o /app/publish

# Exécution 
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 5294
ENV ASPNETCORE_URLS=http://+:5294
ENTRYPOINT ["dotnet", "DigiAlert.Api.dll"]