# Mapping публичных форм в Applications

## Найденные точки входа

Публичный сайт использует один компонент `RequestForm` в нескольких контекстах:

| Route | Назначение | `source_identifier` |
|---|---|---|
| `/` | компактная форма на главной | `homepage` |
| `/request` | основная страница заявки | `request_page` |
| `/services/[slug]` через CTA | заявка из конкретной услуги | `service:<slug>` |
| другие страницы с формой | резервный маршрут | фактический pathname, не более 80 символов |

Форма остаётся визуально и содержательно прежней. Внутренние CRM-поля на публичный сайт не вынесены.

## Поля

| Public field | Required | Application field | Transformation / validation |
|---|---:|---|---|
| `name` | yes | `name` | trim, 2–100 символов, контрольные символы запрещены |
| `contact_method` | yes | `contact_method` | `email`, `phone`, `messenger` |
| `contact` | yes | `contact` | trim; email нормализуется в lower-case; телефон проверяется по 7–15 цифрам |
| derived contact | no | `email`, `phone` | заполняется сервером согласно `contact_method` |
| `requested_service` | yes | `requested_service` | существующие шесть значений публичного каталога |
| `message` | yes | `message` | 10–4000 символов; исходный текст после приёма не переписывается |
| `consent_accepted` | yes | `consent_accepted` | должно быть `true` |
| `consent_version` | yes | `consent_version` | версия публичного текста согласия |
| server timestamp | yes | `consent_at`, `submitted_at` | UTC на API |
| `utm_source` | no | `utm_source` | trim, max 100 |
| `utm_medium` | no | `utm_medium` | trim, max 100 |
| `utm_campaign` | no | `utm_campaign` | trim, max 150 |
| `utm_content` | no | `utm_content` | trim, max 150 |
| `utm_term` | no | `utm_term` | trim, max 150 |
| `source_identifier` | no | `source_identifier` | формируется frontend из текущего route |
| fixed | yes | `source` | `website` |
| `Idempotency-Key` header | yes | `idempotency_key` | 16–128 символов; повтор того же payload возвращает существующую заявку |
| canonical payload | yes | `fingerprint` | SHA-256 без honeypot/timing полей |
| `website` | no | не сохраняется | скрытый honeypot; заполнение означает spam submission |
| `form_started_at` | no | не сохраняется | submission быстрее 1.5 секунды считается автоматизированным |

## Файл публичной формы

Если пользователь выбрал файл, форма отправляет `multipart/form-data` на `/api/public/leads/with-attachment`: JSON находится в поле `payload`, файл — в поле `upload`. Без файла используется JSON-маршрут `/api/public/leads`.

Файл проверяется по разрешённому расширению и сигнатуре, ограничивается 15 МБ, сохраняется вне публичного web-root и доступен только авторизованному сотруднику из карточки заявки. В истории фиксируется событие `public_file_attached`, а повтор того же запроса с тем же `Idempotency-Key` не создаёт дубликат.

## Ответы

- `201` — создана новая заявка;
- `200` — безопасный idempotent retry;
- `409` — ключ повтора использован с другим payload;
- `422` — validation error;
- `429` — превышен rate limit;
- `413` — JSON больше 64 KiB или файл больше 15 МБ.

Публичный frontend переводит ошибки в нейтральные сообщения и не показывает технический `detail` API.
