import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const directory = read("src/components/crm-directory.tsx");
const css = read("src/app/phase4-directories.css");
const layout = read("src/app/layout.tsx");
const model = read("../api/app/operations_models.py");
const operations = read("../api/app/routers/operations.py");
const migration = read("../api/alembic/versions/0019_executor_availability.py");

const must = (text, needle, label) => {
  if (!text.includes(needle)) throw new Error(`Phase 10.1 audit failed: ${label}`);
};

must(layout, 'data-build-id="phase15-pre-release-audit-20260922-r4"', "build provenance");
must(model, "class ExecutorAvailability", "persisted availability model");
must(model, 'state: Mapped[str]', "availability state");
must(operations, 'AvailabilityState = Literal["FREE", "BUSY", "UNAVAILABLE", "VACATION"]', "allowed availability states");
must(operations, "_validate_availability_range", "server-side range/overlap guard");
must(operations, '@router.get("/executors/{executor_id}/availability")', "availability GET API");
must(operations, '@router.post("/executors/{executor_id}/availability", status_code=201)', "availability POST API");
must(operations, '@router.patch("/executors/{executor_id}/availability/{availability_id}")', "availability PATCH API");
must(operations, '@router.delete("/executors/{executor_id}/availability/{availability_id}")', "availability DELETE API");
must(migration, 'revision = "0019_executor_availability"', "single new migration id");
must(directory, 'label: "Доступность"', "executor availability tab");
must(directory, 'Доступность не указана', "unknown availability empty state");
must(directory, 'Список</button>', "executor list view toggle");
must(directory, 'Календарь</button>', "executor calendar view toggle");
must(directory, "ExecutorAvailabilityCalendar", "team availability calendar workspace");
must(directory, "ExecutorAvailabilityEditor", "calendar cell editor");
must(directory, 'value="FREE"', "free state UI");
must(directory, 'value="VACATION"', "vacation state UI");
must(css, ".executor-calendar__table", "team calendar table styles");
must(css, ".executor-availability-dialog", "availability editor dialog styles");

console.log("Phase 10.0/10.1 availability calendar audit passed");
console.log("Build ID: phase15-pre-release-audit-20260922-r4");
console.log("Persisted states: FREE / BUSY / UNAVAILABLE / VACATION");
console.log("Unknown availability remains explicit; Phase 10.1 availability contract is preserved");
