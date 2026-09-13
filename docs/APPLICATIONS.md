# Applications — Phase 2

## Scope

Applications — первый рабочий CRM-модуль. Он принимает заявки публичного Lingvo Connect и ручные обращения, не создавая на этом этапе Clients, Orders, Translators, Finance или интеграции.

## Идентификаторы и статусы

- внутренний primary key: UUID;
- номер менеджера: `LC-A-000001`, формируется PostgreSQL sequence;
- локальные SQLite-тесты используют эквивалентный последовательный allocator;
- минимальные статусы Phase 2: `NEW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.

Статусы являются implementation decision текущей фазы, а не утверждённым расширенным бизнес-каталогом. Новые статусы не добавляются до отдельного подтверждения.

## Данные заявки

Исходные поля: имя, способ связи, контакт, услуга, сообщение, consent, UTM, источник и точка входа. Операционные поля: компания, языки, желаемая дата, ответственный менеджер и внутреннее резюме. `version` защищает PATCH от тихой перезаписи параллельных изменений.

## Workspace

`/admin/applications` поддерживает серверные:

- поиск по номеру, имени, контакту, email, телефону и компании;
- фильтры по статусу, дате поступления, желаемому сроку, менеджеру, источнику, услуге и языку;
- сортировку по номеру, дате поступления, желаемому сроку, обновлению, имени и статусу;
- offset pagination с 10–100 строками;
- URL query params для воспроизводимого состояния списка.

`/admin/applications/[id]` объединяет overview, контакт, исходный запрос, рабочие поля, смену статуса, комментарии, файлы и append-only activity.

`/admin/applications/new` создаёт ручную заявку с `source=manual` для телефона, email и офлайн-обращений.

## Permissions

ADMIN и MANAGER могут читать все заявки, создавать ручные, редактировать операционные поля, назначать ответственного, менять статусы, добавлять комментарии и файлы. MANAGER редактирует только свой комментарий; ADMIN может исправить любой. Activity не имеет update/delete API.

MANAGER по-прежнему получает `403` на users, roles, tariffs, security и system settings. Backend является authoritative layer.

## Comments and activity

Комментарий содержит автора, время, текст и `edited_at`. Activity создаётся в той же транзакции для:

- создания заявки;
- назначения/смены менеджера;
- смены статуса;
- изменения важных рабочих полей;
- создания/редактирования комментария;
- загрузки файла.
- вложения файла посетителем публичного сайта.

Activity metadata не содержит текста сообщения заявки, комментариев, email, телефона или содержимого файлов.

## Files

Файлы хранятся вне PostgreSQL в Docker volume через `LocalApplicationStorage`. В базе находятся generated storage key, оригинальное имя, серверный MIME, размер, SHA-256, uploader и время. Для публичного вложения uploader отсутствует, и интерфейс явно показывает, что файл прикрепил клиент на сайте.

Разрешены: PDF, DOCX, XLSX, PPTX, TXT UTF-8, RTF, PNG, JPG/JPEG. Максимум 15 MiB. Сервер проверяет extension и signature/container structure, генерирует storage filename и отклоняет executable/unknown content. Интерфейс не принимает MIME браузера как источник истины.

Storage class изолирует локальную реализацию и может быть заменён S3-compatible adapter в следующей инфраструктурной фазе.

## Public protection

- Pydantic validation и normalization;
- body limit 64 KiB для JSON и 15 MiB для файла;
- per-IP in-memory rate limit 5/10 min для локального single-process MVP;
- idempotency + fingerprint;
- honeypot;
- минимальное время заполнения;
- CORS только для admin/public origins;
- безопасные ошибки без stack trace;
- PII не записывается в application/security logs.

Перед горизонтальным масштабированием rate limiter необходимо перенести в shared storage.
