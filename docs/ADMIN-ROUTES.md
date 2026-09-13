# Маршруты админ-панели и API

## 1. Правила

- Все административные маршруты требуют активной сессии.
- Права проверяются backend, а не только скрытием элементов UI.
- Коллекции используют серверную пагинацию, фильтры и сортировку.
- Ошибки возвращаются в едином формате с `code`, `message`, `field_errors`, `request_id`.
- API версионируется префиксом `/api`; смена несовместимого контракта требует `/api/v2`.

## 2. Web routes

| Route | Назначение | Роль |
|---|---|---|
| `/login` | вход | anonymous |
| `/` | операционный обзор | admin, manager |
| `/applications` | список заявок | admin, manager |
| `/applications/[id]` | карточка заявки и конвертация | admin, manager |
| `/clients` | компании и частные клиенты | admin, manager |
| `/clients/[id]` | карточка компании/клиента | admin, manager |
| `/orders` | список заказов | admin, manager |
| `/orders/new` | ручное создание заказа | admin, manager |
| `/orders/[id]` | заказ, позиции, файлы, история | admin, manager |
| `/translators` | справочник исполнителей | admin, manager* |
| `/translators/[id]` | карточка исполнителя | admin, manager* |
| `/catalog/services` | услуги | admin |
| `/catalog/statuses` | статусы | admin |
| `/catalog/tariffs` | тарифы и версии | admin |
| `/team` | пользователи и роли | admin |
| `/settings` | системные настройки | admin |

`*` — возможность менеджера редактировать исполнителей требует подтверждения.

## 3. Public API compatibility

| Method | Route | Назначение |
|---|---|---|
| `POST` | `/api/public/leads` | принять текущую заявку публичного сайта без изменения контракта |
| `POST` | `/api/public/leads/with-attachment` | принять ту же заявку вместе с одним проверенным файлом до 15 МБ |

Вложения не включены в действующий контракт. Возможный маршрут загрузки проектируется после решения вопросов хранения, лимитов и безопасности.

## 4. Auth API

| Method | Route | Назначение |
|---|---|---|
| `POST` | `/api/admin/auth/login` | создать сессию |
| `GET` | `/api/admin/auth/session` | получить текущего пользователя и права |
| `POST` | `/api/admin/auth/logout` | отозвать текущую сессию |
| `POST` | `/api/admin/auth/logout-all` | отозвать все сессии пользователя |

## 5. Applications API

| Method | Route | Назначение |
|---|---|---|
| `GET` | `/api/admin/applications` | список: cursor, status, owner, dates, service, search |
| `GET` | `/api/admin/applications/{id}` | карточка заявки |
| `PATCH` | `/api/admin/applications/{id}` | ответственный и внутреннее резюме |
| `POST` | `/api/admin/applications/{id}/status` | контролируемая смена статуса |
| `POST` | `/api/admin/applications/{id}/convert` | атомарно создать клиента/контакт/заказ |
| `GET` | `/api/admin/applications/{id}/activity` | история |

Конвертация использует idempotency key и возвращает уже созданный заказ при безопасном повторе.

## 6. Clients API

| Method | Route | Назначение |
|---|---|---|
| `GET/POST` | `/api/admin/companies` | список и создание компании |
| `GET/PATCH` | `/api/admin/companies/{id}` | чтение и редактирование |
| `POST` | `/api/admin/companies/{id}/archive` | архивировать |
| `GET/POST` | `/api/admin/contacts` | список и создание контакта/частного клиента |
| `GET/PATCH` | `/api/admin/contacts/{id}` | чтение и редактирование |
| `POST` | `/api/admin/contacts/{id}/archive` | архивировать |

## 7. Orders API

| Method | Route | Назначение |
|---|---|---|
| `GET/POST` | `/api/admin/orders` | список и ручное создание |
| `GET/PATCH` | `/api/admin/orders/{id}` | карточка и редактирование общих полей |
| `POST` | `/api/admin/orders/{id}/status` | смена статуса |
| `POST` | `/api/admin/orders/{id}/archive` | архивировать |
| `POST` | `/api/admin/orders/{id}/items` | добавить позицию |
| `GET/PATCH` | `/api/admin/order-items/{id}` | карточка/редактирование позиции |
| `POST` | `/api/admin/order-items/{id}/status` | смена статуса позиции |
| `POST` | `/api/admin/order-items/{id}/assignments` | назначить исполнителя |
| `PATCH` | `/api/admin/assignments/{id}` | срок, статус, гонорар, комментарий |
| `GET` | `/api/admin/orders/{id}/activity` | история заказа |

## 8. Catalog, people and finance API

| Method | Route | Назначение |
|---|---|---|
| `GET/POST` | `/api/admin/translators` | список и создание исполнителя |
| `GET/PATCH` | `/api/admin/translators/{id}` | карточка и редактирование |
| `POST` | `/api/admin/translators/{id}/archive` | архивировать |
| `GET/POST/PATCH` | `/api/admin/catalog/services[...]` | справочник услуг |
| `GET/POST/PATCH` | `/api/admin/catalog/statuses[...]` | справочник статусов |
| `GET/POST` | `/api/admin/tariffs` | тарифы |
| `GET/POST` | `/api/admin/tariffs/{id}/versions` | версии тарифа |
| `GET/PUT` | `/api/admin/order-items/{id}/pricing` | расчетный snapshot |
| `GET/PUT` | `/api/admin/orders/{id}/financials` | счет и оплата |

## 9. Files, comments and dashboard API

| Method | Route | Назначение |
|---|---|---|
| `POST` | `/api/admin/files/upload-intent` | проверить права и подготовить загрузку |
| `POST` | `/api/admin/files/{id}/complete` | зафиксировать загрузку и проверку |
| `GET` | `/api/admin/files/{id}/download` | короткоживущая авторизация скачивания |
| `POST` | `/api/admin/files/{id}/archive` | скрыть/удалить по политике |
| `GET/POST` | `/api/admin/comments` | список и создание для указанной сущности |
| `PATCH` | `/api/admin/comments/{id}` | редактирование с записью аудита |
| `POST` | `/api/admin/comments/{id}/archive` | архивирование |
| `GET` | `/api/admin/dashboard/summary` | количества и ближайшие сроки |

File endpoints являются целевой схемой, но не входят в работу Phase 0 и блокируются решениями из `OPEN-QUESTIONS.md`.

## 10. Служебные маршруты

- `GET /health/live` — процесс запущен;
- `GET /health/ready` — база и обязательные зависимости доступны;
- `GET /api/openapi.json` — контракт для генерации клиента;
- административного route для изменения `activity_logs` нет.
