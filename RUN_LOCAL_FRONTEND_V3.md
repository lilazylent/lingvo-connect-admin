# Local run — Master Reference Frontend v3

Use the existing project `.env` and Docker volumes. Do not use `down -v`.

```powershell
cd "C:\Users\lilaz\OneDrive\Документы\ChatGPT\lingvo-connect-admin"

docker compose down

docker compose up --build -d

docker compose ps
```

Open:

```text
http://localhost:3003
```

If build/start fails, capture the complete terminal error before making additional changes. The backend starts with the project's existing migration/startup sequence; this frontend redesign adds no new migration.
