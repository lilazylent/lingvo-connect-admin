# Lingvo Connect Admin — API

FastAPI service for authentication, secure sessions, two-factor authentication,
role enforcement, user administration, and the security audit trail.

Use the repository root [README](../../README.md) for the supported Docker workflow,
environment setup, database migrations, first-owner bootstrap, and test commands.

Local API checks from this directory:

```powershell
python -m pytest
python -m compileall app
```

No production credentials or encryption keys belong in this directory or in Git.
