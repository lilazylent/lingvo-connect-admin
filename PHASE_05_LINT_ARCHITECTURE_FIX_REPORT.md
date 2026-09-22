# Phase 05 — lint architecture fix

Дата: 2026-09-15
Baseline: `Lingvo_Connect_Admin_Phase_05_Review_Fix_v1.zip`

## Причина патча

Локальный `npm.cmd run lint` пользователя выявил 4 ошибки `react-hooks/set-state-in-effect`:

1. `src/app/admin/applications/page.tsx` — синхронный reset preview-state внутри effect.
2. `src/components/admin-shell.tsx` — синхронное закрытие shell-overlay по `pathname` внутри effect.
3. `src/components/crm-files.tsx` — effect вызывал `load()`, который синхронно менял loading-state.
4. `src/components/crm-orders.tsx` — reset состояния карточки заказа внутри effect при смене `orderId`.

Ошибки исправлены архитектурно. `eslint-disable` для этих четырёх мест не добавлялся.

## Исправления

### Applications preview

`ApplicationPreview` теперь получает `key={selected.id}`. Смена выбранной заявки создаёт новый экземпляр preview, поэтому `tab/detail/error/loading` корректно получают initial state через React lifecycle, а не сбрасываются синхронными `setState` внутри effect. Effect оставлен только для внешней синхронизации — загрузки detail API.

### Admin shell

Удалён effect, который следил за `pathname` и синхронно вызывал три setter-а. Закрытие sidebar/profile/search теперь происходит непосредственно в обработчиках действий навигации через `closeTransientUi()`. Это связывает UI-state с причиной изменения — пользовательской навигацией, а не с последующим наблюдением за route.

### Files registry

Удалён imperative `loading` setter из функции, вызываемой effect-ом. Загрузка теперь моделируется через request identity:

- `request.key` описывает текущий набор query/page;
- `loadedRequestKey` хранит последний завершённый запрос;
- `loading` вычисляется как `loadedRequestKey !== request.key`;
- error также привязан к request key, поэтому устаревшая ошибка не показывается для нового фильтра.

Effect занимается только внешней синхронизацией с API и обновляет state из promise callbacks после завершения запроса.

### Order card

`OrderCard` теперь получает `key={selectedId}`. При выборе другого заказа компонент remount-ится и автоматически получает чистые initial states (`core`, closed editors, payment/details edit false). Reset-effect по `orderId` удалён.

## Проверки в среде сборки патча

- `node scripts/audit-frontend-foundation.mjs` — PASS.
- Foundation CSS импортируется последним — PASS.
- Missing required tokens — 0.
- Contrast failures below 4.5 — 0.
- TypeScript `transpileModule` parser diagnostics по 4 изменённым TSX-файлам — 0.
- Полный `npm ci` в контейнере не завершился в доступное время, поэтому полный ESLint/typecheck/build здесь не заявляются как пройденные.

## Проверка на Windows PowerShell

Использовать `.cmd`, чтобы PowerShell Execution Policy не блокировал `npm.ps1`/`npx.ps1`:

```powershell
cd .\apps\admin-web
npm.cmd ci
npm.cmd run audit:foundation
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npx.cmd playwright test e2e/phase1-shell.spec.ts e2e/phase2-ui-kit.spec.ts e2e/phase3-dashboard-applications.spec.ts e2e/phase4-clients-executors.spec.ts e2e/phase5-orders-order-detail.spec.ts
```
