import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const users = read("src/app/admin/users/page.tsx");
const applications = read("src/app/admin/applications/page.tsx");
const orders = read("src/components/crm-orders.tsx");
const ui = read("src/components/ui.tsx");
const shell = read("src/components/admin-shell.tsx");
const dashboard = read("src/app/admin/page.tsx");

const failures = [];
const requireText = (source, token, message) => { if (!source.includes(token)) failures.push(message); };
const forbidText = (source, token, message) => { if (source.includes(token)) failures.push(message); };

requireText(users, 'api(`/api/admin/users/${user.id}`, { method: "DELETE" })', "Users delete action is not wired to backend DELETE.");
requireText(users, '/reset-password', "Users password reset action is missing.");
requireText(users, '/reset-2fa', "Users 2FA reset action is missing.");
requireText(users, 'body: JSON.stringify({ display_name: name, role })', "Role editing is not wired to backend PATCH.");
requireText(users, '/api/admin/users/invitations', "User invitation creation is not wired to backend.");
requireText(users, 'body: JSON.stringify({ email, role })', "Invitation email/role payload is missing.");
requireText(users, '/new-link', "Invitation link renewal action is missing.");
requireText(users, 'Отменить приглашение', "Invitation cancellation action is missing.");
requireText(applications, '<ActionMenu', "Applications still do not use the shared viewport-safe ActionMenu.");
requireText(orders, '<ActionMenu', "Orders action menu is not using the shared ActionMenu.");
requireText(ui, 'document.addEventListener("pointerdown", closeOutside)', "ActionMenu does not close on outside click.");
requireText(ui, 'event.key === "Escape"', "ActionMenu does not close on Escape.");
requireText(ui, 'createPortal(', "ActionMenu is not portaled outside clipping table containers.");
requireText(ui, 'window.innerWidth - width - margin', "ActionMenu is not viewport-clamped horizontally.");
requireText(ui, 'window.innerHeight - estimatedHeight - margin', "ActionMenu is not viewport-clamped vertically.");
requireText(shell, 'state?.user.role === "ADMIN"', "Admin-only shell navigation role guard is missing.");
requireText(shell, 'document.addEventListener("pointerdown", closeProfileOutside)', "Profile popover does not close on outside click.");
forbidText(dashboard, '>•••<', "Dashboard renders non-functional three-dot action affordances.");
forbidText(applications, '<details className="row-menu">', "Applications still use legacy unclamped details row-menu.");

if (failures.length) {
  console.error("Pre-release RBAC/action audit failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Pre-release RBAC/action audit PASS");
