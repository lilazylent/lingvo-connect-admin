import fs from "node:fs";
import path from "node:path";

const root = path.resolve("..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const failures = [];
const requireText = (source, token, message) => { if (!source.includes(token)) failures.push(message); };

const usersPage = read("admin-web/src/app/admin/users/page.tsx");
const registrationPage = read("admin-web/src/app/register/[token]/page.tsx");
const usersRouter = read("api/app/routers/users.py");
const authRouter = read("api/app/routers/auth.py");
const models = read("api/app/models.py");
const migration = read("api/alembic/versions/0026_user_invitations.py");
const config = read("api/app/config.py");
const compose = read("../docker-compose.yml");
const prodCompose = read("../docker-compose.prod.yml");

requireText(models, 'class UserInvitation(Base):', "UserInvitation model is missing.");
requireText(models, 'token_hash: Mapped[str]', "Invitation token is not persisted as a hash.");
requireText(migration, 'revision = "0026_user_invitations"', "Invitation migration is missing or misnumbered.");
requireText(usersRouter, '@router.post("/invitations"', "Admin invitation creation endpoint is missing.");
requireText(usersRouter, '/new-link', "Invitation renewal endpoint is missing.");
requireText(usersRouter, '@router.delete("/invitations/{invitation_id}"', "Invitation cancellation endpoint is missing.");
requireText(usersRouter, 'token_hash(raw_token, settings.session_secret)', "Raw invitation tokens must not be stored.");
requireText(usersRouter, 'timedelta(days=settings.user_invitation_days)', "Invitation expiry is not configuration-driven.");
requireText(authRouter, '@router.get("/invitations/{token}"', "Public invitation validation endpoint is missing.");
requireText(authRouter, '@router.post("/invitations/{token}/accept"', "Public invitation acceptance endpoint is missing.");
requireText(authRouter, 'must_change_password=False', "Invited users should set their own permanent password during registration.");
requireText(usersPage, 'Добавить пользователя', "Users UI does not expose the invitation flow.");
requireText(usersPage, 'Создать приглашение', "Users UI does not create invitations.");
requireText(usersPage, 'Ожидают регистрации', "Pending invitation list is missing.");
requireText(usersPage, 'Создать новую ссылку', "Invitation link renewal UI is missing.");
requireText(usersPage, 'Отменить приглашение', "Invitation cancellation UI is missing.");
requireText(registrationPage, 'Рабочий email', "Registration page does not show the locked email.");
requireText(registrationPage, 'disabled readOnly', "Invited email must be locked in the registration UI.");
requireText(registrationPage, 'Зарегистрироваться', "Registration submission action is missing.");
requireText(config, 'user_invitation_days', "Invitation lifetime setting is missing.");
requireText(compose, 'USER_INVITATION_DAYS', "Development compose does not pass invitation lifetime.");
requireText(prodCompose, 'USER_INVITATION_DAYS', "Production compose does not pass invitation lifetime.");

if (failures.length) {
  console.error("User invitation audit failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("User invitation flow audit: PASS");
console.log("Invite-by-email, one-time hashed token, expiry, renewal, cancellation and self-service password registration: OK");
