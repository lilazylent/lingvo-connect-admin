# Phase 15 Pre-Release — User Invitation Registration Patch

Build ID: `phase15-pre-release-audit-20260922-r4`

## Goal
Replace the normal admin-created temporary-password workflow for new staff with an invitation-first registration flow while preserving the existing ADMIN/MANAGER RBAC model and registered-user security operations.

## Implemented
- ADMIN creates an invitation with a fixed work email and role.
- Backend returns a one-time registration URL based on `ADMIN_WEB_ORIGIN`.
- Only the invitation token hash is persisted; the raw token is returned only when created or renewed.
- Invitations expire after `USER_INVITATION_DAYS` (default: 7).
- Pending and expired invitations are visible in Users.
- ADMIN can renew an invitation link; renewal invalidates the previous link.
- ADMIN can cancel an invitation; cancelled links stop working.
- Registration page keeps the invited email locked and does not allow role selection.
- Invited employee creates their own permanent password; no temporary password is exposed to ADMIN.
- Successful registration consumes the invitation, creates the user with the preassigned role, starts an authenticated session, and continues into mandatory 2FA setup.
- Existing registered-user password reset remains unchanged and continues to use a one-time temporary password.
- Existing hard-delete, self-protection, last-active-admin and RBAC rules remain intact.

## Database
New Alembic migration: `0026_user_invitations`.

New table: `user_invitations` with email, role, hashed token, creator, accepted user, expiry, accepted/cancelled timestamps and audit timestamps.

## Verification
- Python compileall: PASS.
- Alembic single head: `0026_user_invitations`.
- Dedicated invitation full smoke test: PASS (create, duplicate guard, renew, old-token invalidation, expiry, cancel, accept, one-time use, own password).
- Frontend TSX parser check for changed TSX: PASS.
- Existing frontend audit suite Phase 8 → Phase 15: PASS.
- CSS ownership audit: PASS.
- UI copy guard: PASS.
- Pre-release RBAC/action audit: PASS.
- New user invitation static audit: PASS.

Full `npm ci`/`npm run typecheck` could not be completed in the artifact environment because outbound package-network access was unavailable. No dependency versions were changed.
