# Lingvo Connect Admin

Отдельная локальная административная система Lingvo Connect. Phase 1 реализует защищённый фундамент и управление доступом. Phase 2 добавляет первый полноценный CRM-модуль Applications и интеграцию реальной формы публичного сайта.

## Stack

- Frontend: Next.js 16, React 19, TypeScript.
- Backend: Python 3.12, FastAPI, SQLAlchemy, Alembic.
- Database: PostgreSQL 17.
- Local runtime: Docker Compose.
- Security: Argon2id, opaque server sessions, HttpOnly cookies, CSRF double-submit, encrypted TOTP, single-use recovery codes.

## Первый локальный запуск

Из корня репозитория:

```powershell
.\scripts\init-local-env.ps1
docker compose up --build -d
docker compose ps
```

Скрипт создает `.env` с уникальными локальными секретами. Файл игнорируется Git. Не копируйте значения из `.env.example` как рабочие credentials.

Адреса:

- Admin UI: <http://localhost:3003>
- Backend API: <http://localhost:8002>
- OpenAPI: <http://localhost:8002/docs>
- PostgreSQL на host: `localhost:5434`

Остановка без удаления данных:

```powershell
docker compose down
```

Полный сброс локальной базы является destructive action и выполняется только осознанно:

```powershell
docker compose down --volumes
```

## Миграции

Backend автоматически выполняет `alembic upgrade head` перед запуском. Ручные команды:

```powershell
docker compose exec backend alembic current
docker compose exec backend alembic upgrade head
docker compose exec backend alembic downgrade -1
```

## Initial ADMIN bootstrap

Пароль в команду не передается и в repository не сохраняется. Интерактивный вариант:

```powershell
docker compose exec backend python -m app.cli.bootstrap --email owner@example.com --name "Владелец проекта"
```

Команда запросит временный пароль без отображения. Альтернативно можно безопасно сгенерировать пароль и показать его один раз:

```powershell
docker compose exec backend python -m app.cli.bootstrap --email owner@example.com --name "Владелец проекта" --generate-password
```

Bootstrap повторно не создает пользователя с тем же email. Первый пароль всегда временный.

## Final pre-release data cleanup

Перед переносом уже использованной локальной базы на hosting можно безопасно удалить тестовые заявки, заказы, клиентов, исполнителей, файлы, приглашения и лишних пользователей, сохранив основной ADMIN и системные справочники/тарифы. Сначала выполните dry-run:

```powershell
.\scripts\pre-release-cleanup.ps1
```

Если в базе один ADMIN, он будет выбран автоматически. Если ADMIN несколько, укажите нужный email:

```powershell
.\scripts\pre-release-cleanup.ps1 -KeepAdminEmail owner@example.com
```

После проверки строки `ADMIN to keep` выполните очистку:

```powershell
.\scripts\pre-release-cleanup.ps1 -Execute
```

или при нескольких администраторах:

```powershell
.\scripts\pre-release-cleanup.ps1 -Execute -KeepAdminEmail owner@example.com
```

Команда сохраняет пароль, 2FA, recovery codes и пользовательские настройки выбранного ADMIN, но очищает активные сессии, поэтому после выполнения потребуется войти заново. Reference-данные (`service_types`, языки, статусы заказов, тарифы, pricing rules и Alembic schema state) не удаляются. Файлы из `APPLICATION_STORAGE_PATH` очищаются полностью.

## Login и security flow

```text
Initial ADMIN / reset-password flow
  → обязательная смена временного пароля
  → обязательная настройка TOTP authenticator
  → одноразовый показ 10 recovery codes
  → authenticated admin shell

Invited employee flow
  → одноразовая registration link, закреплённая за email и ролью
  → сотрудник задаёт собственный постоянный пароль
  → обязательная настройка TOTP authenticator
  → одноразовый показ 10 recovery codes
  → authenticated admin shell
```

При последующих входах после пароля требуется TOTP. Recovery code заменяет TOTP один раз и немедленно помечается использованным. Прямой переход по URL не пропускает обязательные стадии: backend отклоняет защищенные операции до статуса `AUTHENTICATED`.

## Роли и фактические права

### ADMIN

- полный доступ к shell и будущим операционным модулям;
- список пользователей и приглашения по рабочему email;
- роли, активация/деактивация;
- сброс пароля и 2FA другого пользователя;
- доступ к защищенным administrative endpoints.

### MANAGER

- видит все заявки и может выполнять operational actions Applications;
- не видит Users/Settings в navigation;
- backend возвращает `403` для users, roles, global tariffs и system/security settings;
- ограничения не зависят от frontend visibility.

Clients, Orders, Translators, Finance и внешние интеграции не входят в Phase 2. Файлы доступны только внутри Applications.

## Applications

- `/admin/applications` — поиск, фильтры, сортировка и серверная пагинация;
- `/admin/applications/new` — ручная регистрация;
- `/admin/applications/[id]` — статус, менеджер, рабочие поля, комментарии, файлы и activity;
- `POST /api/public/leads` — совместимый endpoint публичной формы;
- `POST /api/public/leads/with-attachment` — тот же поток с защищённым вложением;
- `/api/admin/dashboard/summary` — только реальные application counts.

Подробности: [Applications](docs/APPLICATIONS.md) и [Public form mapping](docs/PUBLIC-FORM-MAPPING.md).

## User management

Маршрут `/admin/users` доступен только ADMIN. Новые сотрудники добавляются через одноразовое приглашение: администратор задаёт рабочий email и роль, получает ссылку вида `${ADMIN_WEB_ORIGIN}/register/<token>` и передаёт её сотруднику. Ссылка по умолчанию действует 7 дней (`USER_INVITATION_DAYS`), может быть перевыпущена или отменена, а в базе хранится только хеш токена. Email в форме регистрации зафиксирован приглашением; сотрудник самостоятельно задаёт постоянный пароль и затем подключает обязательную 2FA.

Сброс пароля уже зарегистрированного пользователя остаётся административной security-операцией с одноразовым временным паролем. Деактивация и security reset отзывают активные сессии.

## Development checks

Frontend:

```powershell
cd apps/admin-web
npm ci
npm run lint
npm run typecheck
npm run build
```

Backend tests без production-данных:

```powershell
python -m venv .venv-api
.\.venv-api\Scripts\python.exe -m pip install -e ".\apps\api[test]"
cd apps/api
..\..\.venv-api\Scripts\python.exe -m pytest
```

## Security notes

- Не коммитить `.env`, реальные email/password, session secrets, TOTP secrets, recovery codes, dumps или uploads.
- Production должен использовать HTTPS и `COOKIE_SECURE=true`.
- TOTP secret хранится зашифрованным Fernet-ключом из окружения.
- Session и recovery tokens хранятся только как keyed hashes.
- Security audit не содержит plaintext password, TOTP secret или recovery code.
- Login rate limiter Phase 1 работает в памяти одного backend process; перед горизонтальным масштабированием его нужно перенести в shared store.

## Documentation

- [MVP scope](docs/ADMIN-MVP-SCOPE.md)
- [Architecture](docs/ADMIN-ARCHITECTURE.md)
- [Database schema](docs/DATABASE-SCHEMA.md)
- [Routes](docs/ADMIN-ROUTES.md)
- [User flows](docs/USER-FLOWS.md)
- [Resolved and open questions](docs/OPEN-QUESTIONS.md)
- [Requirements traceability](docs/REQUIREMENTS-TRACEABILITY.md)
- [Implementation plan](docs/IMPLEMENTATION-PLAN.md)
- [Applications](docs/APPLICATIONS.md)
- [Public form mapping](docs/PUBLIC-FORM-MAPPING.md)

## Git isolation

До подключения удалённого репозитория проект остаётся local-only:

```powershell
git remote -v
```

Не добавлять remote и не создавать GitHub repository без прямого разрешения владельца. После подключения публикация выполняется только в согласованную ветку без force-push.
