# Pre-release final cleanup — RC v4

## UI spacing polish

- Increased vertical rhythm in the Phase 15 client deposit panel so the current-balance card no longer visually collides with the amount/comment editor.
- Increased separation before the deposit operation history.
- Increased spacing above the order deposit preview.
- Reviewed the newest invitation UI and increased the outer pending-invitation separation and invite-dialog body rhythm without undoing the compact Phase 14 form-density work.

## Clean deployment data path

Added `python -m app.cli.pre_release_cleanup`.

The cleanup preserves one ADMIN account and all required reference/configuration data (services, languages, order statuses, tariffs, pricing rules, Alembic schema state), while removing operational/test data:

- applications and their comments/files/activity;
- orders, works, assignments, payments, deposit ledger and numbering counters;
- clients, representatives and client activity;
- executors, directions and availability;
- import batches, operational/security audit history;
- pending invitations;
- all sessions;
- every user except the preserved ADMIN;
- all files from application storage.

The preserved ADMIN keeps password, 2FA configuration, theme/preferences and recovery codes. Running the cleanup clears sessions, so a fresh login is required.

The command is dry-run by default and refuses to guess when more than one ADMIN exists.
