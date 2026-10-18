# ClubConnect
Clubconnect is a multi-tenant web app that centralizes local club management, replacing messy spreadsheets and chats. Each secure club environment features an interactive calendar, a Kanban board for tasks, and a logistics module for equipment and keys. A strict role-based system ensures the board maintains full control.

---

## Local Development Setup

### 1. Start Local PostgreSQL Database

An isolated PostgreSQL 17 service is configured in `docker-compose.yml`:

```bash
docker compose up -d postgres
```

The database is accessible at `localhost:5432` with credentials:
- **Database:** `clubconnect`
- **User:** `clubconnect`
- **Password:** `clubconnect`

### 2. Apply Database Migrations

Database migrations are managed via Entity Framework Core. Migrations are **not** applied automatically on normal application startup.

Apply pending migrations using either method:

**Option A (Direct application CLI — no extra tools required):**
```bash
dotnet run --project backend/ClubConnect.Api -- --migrate
```

**Option B (Via dotnet-ef CLI tool):**
```bash
# Restore local tools (first time only)
dotnet tool restore

# Apply migrations
dotnet ef database update --project backend/ClubConnect.Infrastructure --startup-project backend/ClubConnect.Api
```

### 3. Creating New Migrations

When modifying entities or the DbContext model in `ClubConnect.Infrastructure` or `ClubConnect.Domain`:

```bash
dotnet ef migrations add <MigrationName> --project backend/ClubConnect.Infrastructure --startup-project backend/ClubConnect.Api --output-dir Persistence/Migrations
```

### 4. Running the Application

**Backend API:**
```bash
dotnet run --project backend/ClubConnect.Api
```
- Health endpoint: `http://127.0.0.1:5069/health`
- OpenAPI document (Development only): `http://127.0.0.1:5069/openapi/v1.json`

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Safe Migration Strategy (NON-PROD & PROD)

In multi-instance and production environments, migrations must **never** be executed automatically during application startup (`app.Run()`). Automatic startup migrations introduce race conditions across replicas and risk application downtime.

### Deployment Workflow:
1. **Pre-Deployment Migration Job:** Run migrations as an isolated, one-off deployment task (or Kubernetes Job / CI pre-deploy step) before routing traffic to new container versions:
   ```bash
   dotnet run --project backend/ClubConnect.Api --configuration Release --no-launch-profile -- --migrate
   ```
2. **Backward Compatibility:** All migrations follow the expand/contract pattern so running instances remain operational during rolling deployments.
3. **Application Container Rollout:** After the migration job completes successfully, deploy the updated application containers.

---

## Automated Deployment & CI/CD

ClubConnect uses automated CI/CD deployment pipelines managed with GitHub Actions and Docker Compose.

- **Deployment Manual & Runbooks:** See [devops/DEPLOYMENT.md](devops/DEPLOYMENT.md) for full details on:
  - Staging (`CC-NPR`) and Production server setup
  - GitHub Actions manual deployment trigger (`workflow_dispatch`)
  - Automated database backup and retention policy
  - Health checks and smoke tests
  - Fast rollback procedures


