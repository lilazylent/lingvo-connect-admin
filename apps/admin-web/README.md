# Lingvo Connect Admin — web application

The Next.js administrative interface for the private Lingvo Connect operations system.
It provides the authentication journey, role-aware application shell, user management,
and guarded placeholders for the operational modules planned after Phase 1.

Use the repository root [README](../../README.md) for the supported Docker workflow,
security notes, bootstrap procedure, and test commands.

For frontend-only development:

```powershell
npm ci
npm run dev
```

The application expects the API under `/api`; in Docker this is proxied to the FastAPI
service by the Next.js rewrite configuration.

Quality checks:

```powershell
npm run lint
npm run typecheck
npm run build
```
