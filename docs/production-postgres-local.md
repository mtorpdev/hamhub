# Local API With Production PostgreSQL

HamHub production uses the GitHub secret `HAMHUB_DB_CONNECTION_STRING`, deployed as `ConnectionStrings__DefaultConnection` in `.env.production`.

For local testing against the same PostgreSQL server, create an ignored file at the repository root:

```bash
cp .env.example .env.production.local
```

Edit `.env.production.local` and replace the example connection string with the real production PostgreSQL value.

Start the local API with:

```bash
./scripts/run-api-production-db.sh
```

The script refuses to start if no production database connection string is configured. It also accepts `HAMHUB_DB_CONNECTION_STRING` as an alias and maps it to ASP.NET Core's `ConnectionStrings__DefaultConnection`.

The community chat schema is covered by the EF migration `AddCommunityChat`. The API also has a startup schema guard for `ChatMessages`, so production gets the table on restart even if the database was originally created outside EF migrations.
