# HamHub MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready ham radio community MVP with .NET 8 backend and Next.js 15 frontend.

**Architecture:** Clean Architecture backend (Domain/Application/Infrastructure/Api layers), Next.js App Router frontend with JWT auth, PostgreSQL via EF Core.

**Tech Stack:** .NET 8, ASP.NET Core, EF Core, PostgreSQL, Next.js 15, TypeScript, Tailwind CSS, JWT

---

## Phase 1: Backend Foundation

### Task 1: Solution & Project Setup

**Files:**
- Create: `backend/HamHub.sln`
- Create: `backend/HamHub.Domain/HamHub.Domain.csproj`
- Create: `backend/HamHub.Application/HamHub.Application.csproj`
- Create: `backend/HamHub.Infrastructure/HamHub.Infrastructure.csproj`
- Create: `backend/HamHub.Api/HamHub.Api.csproj`

- [ ] Create solution and projects
```bash
cd /d/hamhub/backend
dotnet new sln -n HamHub
dotnet new classlib -n HamHub.Domain --framework net8.0
dotnet new classlib -n HamHub.Application --framework net8.0
dotnet new classlib -n HamHub.Infrastructure --framework net8.0
dotnet new webapi -n HamHub.Api --framework net8.0
dotnet sln add HamHub.Domain HamHub.Application HamHub.Infrastructure HamHub.Api
dotnet add HamHub.Application reference HamHub.Domain
dotnet add HamHub.Infrastructure reference HamHub.Application
dotnet add HamHub.Api reference HamHub.Infrastructure
```

- [ ] Add NuGet packages
```bash
cd HamHub.Infrastructure
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore

cd ../HamHub.Application
dotnet add package AutoMapper
dotnet add package AutoMapper.Extensions.Microsoft.DependencyInjection
dotnet add package Microsoft.Extensions.DependencyInjection.Abstractions

cd ../HamHub.Api
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add package Swashbuckle.AspNetCore
dotnet add package Microsoft.EntityFrameworkCore.Design
```

- [ ] Commit: `git init && git add . && git commit -m "chore: initialize solution structure"`

---

### Task 2: Domain Entities

**Files:**
- Create: `backend/HamHub.Domain/Entities/ApplicationUser.cs`
- Create: `backend/HamHub.Domain/Entities/StationProfile.cs`
- Create: `backend/HamHub.Domain/Entities/QsoEntry.cs`
- Create: `backend/HamHub.Domain/Entities/DxSpot.cs`
- Create: `backend/HamHub.Domain/Entities/Article.cs`
- Create: `backend/HamHub.Domain/Entities/ArticleCategory.cs`
- Create: `backend/HamHub.Domain/Enums/Band.cs`
- Create: `backend/HamHub.Domain/Enums/Mode.cs`
- Create: `backend/HamHub.Domain/Enums/LicenseClass.cs`
- Create: `backend/HamHub.Domain/Enums/ProfileVisibility.cs`

- [ ] Write all domain entities (see spec for fields)
- [ ] Commit: `feat: add domain entities`

---

### Task 3: Infrastructure - DbContext & EF Config

**Files:**
- Create: `backend/HamHub.Infrastructure/Persistence/ApplicationDbContext.cs`
- Create: `backend/HamHub.Infrastructure/Persistence/Configurations/` (one per entity)
- Create: `backend/HamHub.Infrastructure/Persistence/Seeders/DataSeeder.cs`
- Create: `backend/HamHub.Infrastructure/DependencyInjection.cs`

- [ ] Write ApplicationDbContext extending IdentityDbContext
- [ ] Write entity configurations with indexes
- [ ] Write DataSeeder (admin user + 5 users + 20 QSOs + 10 spots + 5 articles)
- [ ] Commit: `feat: add infrastructure persistence layer`

---

### Task 4: Application Layer - DTOs & Services

**Files:**
- Create: `backend/HamHub.Application/Common/Interfaces/IApplicationDbContext.cs`
- Create: `backend/HamHub.Application/Common/Interfaces/ITokenService.cs`
- Create: `backend/HamHub.Application/Common/Mappings/MappingProfile.cs`
- Create: `backend/HamHub.Application/Auth/DTOs/` (Register, Login, AuthResponse)
- Create: `backend/HamHub.Application/Users/DTOs/` (UserDto, UpdateUserDto)
- Create: `backend/HamHub.Application/Stations/DTOs/`
- Create: `backend/HamHub.Application/QsoEntries/DTOs/`
- Create: `backend/HamHub.Application/DxSpots/DTOs/`
- Create: `backend/HamHub.Application/Articles/DTOs/`
- Create: `backend/HamHub.Application/Admin/DTOs/DashboardStatsDto.cs`
- Create: `backend/HamHub.Infrastructure/Services/TokenService.cs`
- Create: `backend/HamHub.Application/DependencyInjection.cs`

- [ ] Write all DTOs
- [ ] Write AutoMapper MappingProfile
- [ ] Write TokenService (JWT generation)
- [ ] Commit: `feat: add application layer DTOs and services`

---

### Task 5: API Controllers

**Files:**
- Create: `backend/HamHub.Api/Controllers/AuthController.cs`
- Create: `backend/HamHub.Api/Controllers/UsersController.cs`
- Create: `backend/HamHub.Api/Controllers/StationsController.cs`
- Create: `backend/HamHub.Api/Controllers/QsosController.cs`
- Create: `backend/HamHub.Api/Controllers/SpotsController.cs`
- Create: `backend/HamHub.Api/Controllers/ArticlesController.cs`
- Create: `backend/HamHub.Api/Controllers/AdminController.cs`
- Create: `backend/HamHub.Api/Program.cs`
- Create: `backend/HamHub.Api/appsettings.json`
- Create: `backend/HamHub.Api/appsettings.Development.json`

- [ ] Write Program.cs (JWT, Identity, EF, CORS, Swagger)
- [ ] Write all controllers with proper HTTP responses
- [ ] Write appsettings with connection string placeholder
- [ ] Commit: `feat: add API controllers`

---

### Task 6: EF Migrations & Build Verification

- [ ] Create migration
```bash
cd /d/hamhub/backend
dotnet ef migrations add InitialCreate --project HamHub.Infrastructure --startup-project HamHub.Api
dotnet build
```
- [ ] Fix any build errors
- [ ] Commit: `feat: add initial EF Core migration`

---

## Phase 2: Frontend

### Task 7: Next.js Project Setup

**Files:**
- Create: `frontend/` (Next.js 15 app)
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/auth.ts`
- Create: `frontend/src/contexts/AuthContext.tsx`
- Create: `frontend/src/middleware.ts`

- [ ] Create Next.js project
```bash
cd /d/hamhub
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --import-alias "@/*" --no-git
```
- [ ] Write types matching backend DTOs
- [ ] Write API client (fetch wrapper)
- [ ] Write AuthContext + useAuth hook
- [ ] Write middleware for protected routes
- [ ] Commit: `feat: initialize Next.js frontend`

---

### Task 8: Layout Components

**Files:**
- Create: `frontend/src/components/layout/Navbar.tsx`
- Create: `frontend/src/components/layout/Footer.tsx`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/Input.tsx`
- Create: `frontend/src/components/ui/Badge.tsx`
- Create: `frontend/src/components/ui/Table.tsx`

- [ ] Write Navbar (logo, links, auth state, dark mode toggle)
- [ ] Write Footer
- [ ] Write root layout with AuthProvider + dark mode
- [ ] Write reusable UI components
- [ ] Commit: `feat: add layout and UI components`

---

### Task 9: Public Pages

**Files:**
- Create: `frontend/src/app/page.tsx` (Home)
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/register/page.tsx`
- Create: `frontend/src/app/callsign-search/page.tsx`
- Create: `frontend/src/app/articles/page.tsx`
- Create: `frontend/src/app/articles/[slug]/page.tsx`

- [ ] Write Home page (hero, stats, latest spots, articles, CTA)
- [ ] Write Login/Register forms with API integration
- [ ] Write Callsign Search page
- [ ] Write Articles list and detail pages
- [ ] Commit: `feat: add public pages`

---

### Task 10: Authenticated Pages

**Files:**
- Create: `frontend/src/app/dashboard/page.tsx`
- Create: `frontend/src/app/profile/page.tsx`
- Create: `frontend/src/app/stations/page.tsx`
- Create: `frontend/src/app/stations/new/page.tsx`
- Create: `frontend/src/app/logbook/page.tsx`
- Create: `frontend/src/app/logbook/new/page.tsx`
- Create: `frontend/src/app/spots/page.tsx`
- Create: `frontend/src/app/spots/new/page.tsx`

- [ ] Write Dashboard (welcome, quick stats, recent QSOs, spots)
- [ ] Write Profile edit page
- [ ] Write Stations list + create form
- [ ] Write QSO Logbook table + new entry form
- [ ] Write DX Spots feed + new spot form
- [ ] Commit: `feat: add authenticated pages`

---

### Task 11: Admin Pages

**Files:**
- Create: `frontend/src/app/admin/page.tsx`
- Create: `frontend/src/app/admin/articles/page.tsx`
- Create: `frontend/src/app/admin/users/page.tsx`

- [ ] Write Admin dashboard with stats cards
- [ ] Write Article management (list, create, publish)
- [ ] Write User management table
- [ ] Commit: `feat: add admin pages`

---

### Task 12: README & Final Verification

**Files:**
- Create: `README.md`

- [ ] Write README (setup, env vars, migration, run commands, admin credentials)
- [ ] Run `dotnet build` — fix errors
- [ ] Run `cd frontend && npm run build` — fix errors
- [ ] Commit: `docs: add README`

---

## Key Config Values

**Backend appsettings.Development.json:**
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=hamhub;Username=postgres;Password=postgres"
  },
  "JwtSettings": {
    "Secret": "HamHub-Super-Secret-Key-MinLength-32-Chars!",
    "Issuer": "HamHub",
    "Audience": "HamHub",
    "ExpiryMinutes": 1440
  }
}
```

**Frontend .env.local:**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**Admin seed credentials:**
- Email: admin@hamhub.local
- Password: Admin123!
