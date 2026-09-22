const operationalActivityLabels: Record<string, string> = {
  "application.linked": "Заявка связана с клиентом",
  "company.created": "Создан клиент",
  "company.updated": "Изменены данные клиента",
  "company.archived": "Клиент перемещён в архив",
  "company.restored": "Клиент восстановлен из архива",
  "representative.created": "Добавлено контактное лицо",
  "representative.updated": "Изменены данные контактного лица",
  "representative.archived": "Контактное лицо перемещено в архив",
  "representative.restored": "Контактное лицо восстановлено из архива",
  "executor.created": "Создан исполнитель",
  "executor.updated": "Изменены данные исполнителя",
  "executor.archived": "Исполнитель перемещён в архив",
  "executor.restored": "Исполнитель восстановлен из архива",
  "executor.availability.created": "Добавлен период доступности",
  "executor.availability.updated": "Изменён период доступности",
  "executor.availability.archived": "Удалён период доступности",
  "order.created": "Создан заказ",
  "order.updated": "Изменены данные заказа",
  "order.archived": "Заказ перемещён в архив",
  "order.restored": "Заказ восстановлен из архива",
  "order.wizard_created": "Заказ создан через мастер регистрации",
  "order.details_updated": "Изменены основные данные заказа",
  "order.status_changed": "Изменён статус заказа",
  "order.client_payment_updated": "Изменена информация об оплате клиента",
  "work.created": "Добавлена работа",
  "work.updated": "Изменена работа",
  "work.crm_created": "Добавлена работа в заказ",
  "work.crm_updated": "Изменена работа в заказе",
  "work.duplicated": "Работа продублирована",
  "work.reordered": "Изменён порядок работ",
  "work.archived": "Работа перемещена в архив",
  "work.executor_payment_updated": "Изменена оплата исполнителю",
  "file.uploaded": "Добавлен файл",
  "file.analyzed": "Файл загружен и проанализирован",
  "import.created": "Заказ создан импортом",
};

const applicationActivityLabels: Record<string, string> = {
  application_created: "Заявка создана",
  status_changed: "Статус заявки изменён",
  manager_assigned: "Назначен ответственный менеджер",
  manager_changed: "Ответственный менеджер изменён",
  application_updated: "Данные заявки обновлены",
  comment_created: "Добавлен комментарий",
  comment_edited: "Комментарий отредактирован",
  file_uploaded: "Загружен файл",
  public_file_attached: "Клиент прикрепил файл",
  order_created: "Из заявки создан заказ",
  client_linked: "Заявка связана с клиентом",
  user_activated: "Пользователь активирован",
};

export function operationalActivityLabel(action: string | null | undefined) {
  if (!action) return "Системное событие";
  return operationalActivityLabels[action] ?? "Системное событие";
}

export function applicationActivityLabel(eventType: string | null | undefined) {
  if (!eventType) return "Системное событие";
  return applicationActivityLabels[eventType] ?? "Системное событие";
}

export function formatActivityDate(value: string | null | undefined) {
  if (!value) return "Дата не указана";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
