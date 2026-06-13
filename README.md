# HamHub

Moderne community platform for amatørradiooperatører i Danmark.

## Forudsætninger

- .NET 8 SDK
- Node.js 18+
- PostgreSQL 14+

## Opsætning

### 1. PostgreSQL

Opret en database:

```sql
CREATE DATABASE hamhub;
```

### 2. Backend

```bash
cd backend
```

Opdater connection string i `HamHub.Api/appsettings.Development.json` hvis din PostgreSQL konfiguration afviger:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Database=hamhub;Username=postgres;Password=postgres"
}
```

Start backend (databasen oprettes og seed-data indlæses automatisk):

```bash
dotnet run --project HamHub.Api
```

API kører på: `http://localhost:5000`
Swagger UI: `http://localhost:5000/swagger`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend kører på: `http://localhost:3000`

## Standard admin-konto

| Felt | Værdi |
|------|-------|
| Email | admin@hamhub.local |
| Adgangskode | Admin123! |
| Kaldesignal | OZ1ADM |

## Seed-data

Ved første opstart oprettes automatisk:

- 1 admin-bruger (se ovenfor)
- 5 eksempel-brugere (adgangskode: `User123!`)
- 5 eksempel-stationer
- 20 eksempel-QSOer
- 10 DX-spots
- 5 artikler

## API Endpoints

| Ressource | Endpoints |
|-----------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login` |
| Users | `GET /api/users`, `GET /api/users/{id}`, `GET /api/users/me`, `PUT /api/users/me` |
| Stations | `GET /api/stations`, `POST /api/stations`, `PUT /api/stations/{id}`, `DELETE /api/stations/{id}` |
| QSOs | `GET /api/qsos`, `POST /api/qsos`, `PUT /api/qsos/{id}`, `DELETE /api/qsos/{id}` |
| DX Spots | `GET /api/spots`, `POST /api/spots`, `DELETE /api/spots/{id}` |
| Articles | `GET /api/articles`, `GET /api/articles/{slug}`, `POST /api/articles`, `PUT /api/articles/{id}`, `POST /api/articles/{id}/publish` |
| Admin | `GET /api/admin/dashboard` |

## Miljøvariabler (Frontend)

Opret `.env.local` i `frontend/` mappen:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Projekt-struktur

```
hamhub/
├── backend/
│   ├── HamHub.Domain/          # Entiteter og enums
│   ├── HamHub.Application/     # DTOs, interfaces, AutoMapper
│   ├── HamHub.Infrastructure/  # DbContext, EF konfiguration, seed
│   └── HamHub.Api/             # Controllers, Program.cs
└── frontend/
    └── src/
        ├── app/                # Next.js App Router sider
        ├── components/         # UI og feature-komponenter
        ├── contexts/           # Auth context
        └── lib/                # API-klient, typer, utils
```

## 73

God fornøjelse med HamHub! 73 de HamHub-teamet.
