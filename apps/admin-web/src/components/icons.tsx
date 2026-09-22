import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "overview" | "applications" | "clients" | "orders" | "executors" | "files" | "users" | "settings"
  | "search" | "bell" | "chevron-down" | "menu" | "plus" | "arrow-right" | "folder" | "document"
  | "clock" | "hourglass" | "wallet" | "user" | "upload" | "bolt" | "database" | "trend" | "shield"
  | "calendar" | "filter" | "download" | "close" | "more";

export function Pictogram({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <span className={`lc-pictogram ${className}`.trim()} data-pictogram={name} aria-hidden="true">
      <span className="lc-pictogram__orbit" />
      <Icon name={name} size={size} />
      <span className="lc-pictogram__dot" />
    </span>
  );
}

export function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, ReactNode> = {
    overview: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
    applications: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h6M9 16h6"/></>,
    clients: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    orders: <><rect x="4" y="3" width="13" height="18" rx="2"/><path d="M8 7h5M8 11h5"/><circle cx="18" cy="17" r="3"/><path d="m20.2 19.2 1.8 1.8"/></>,
    executors: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="m17 8 1.5 1.5L22 6"/></>,
    files: <><path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2"/></>,
    users: <><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/><path d="M19 8v6M16 11h6"/></>,
    settings: <><circle cx="12" cy="12" r="3.15"/><path d="M12 2.75v2.1M12 19.15v2.1M2.75 12h2.1M19.15 12h2.1M5.46 5.46l1.48 1.48M17.06 17.06l1.48 1.48M18.54 5.46l-1.48 1.48M6.94 17.06l-1.48 1.48"/><circle cx="12" cy="12" r="7.15"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    "chevron-down": <path d="m6 9 6 6 6-6"/>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    "arrow-right": <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    folder: <><path d="M3 6h7l2 2h9v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    document: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    hourglass: <><path d="M6 3h12M6 21h12M8 3c0 4 2 5 4 7 2-2 4-3 4-7M8 21c0-4 2-5 4-7 2 2 4 3 4 7"/></>,
    wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/><path d="M2 8h17M16 13h5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7z"/>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    trend: <><path d="M4 18V9M10 18V5M16 18v-7M22 18V3"/></>,
    shield: <><path d="M12 3 4 6v5c0 5 3.4 8.2 8 10 4.6-1.8 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    filter: <path d="M3 5h18l-7 8v6l-4 2v-8z"/>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
  };
  return <svg {...common} {...props}>{paths[name]}</svg>;
}
