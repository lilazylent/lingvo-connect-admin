export type Role = "ADMIN" | "MANAGER";
export type AuthStage =
  | "CHANGE_PASSWORD"
  | "TWO_FACTOR_SETUP"
  | "TWO_FACTOR_VERIFY"
  | "AUTHENTICATED";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface AuthState {
  stage: AuthStage;
  user: User;
}

export type ApplicationStatus = "NEW" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ApplicationSource = "website" | "manual";

export interface UserSummary {
  id: string;
  display_name: string;
  email: string;
}

export interface Application {
  id: string;
  number: string;
  name: string;
  contact_method: string;
  contact: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  requested_service: string;
  source_language: string | null;
  target_language: string | null;
  message: string;
  desired_date: string | null;
  status_code: ApplicationStatus;
  responsible_manager: UserSummary | null;
  internal_summary: string | null;
  source: ApplicationSource;
  source_identifier: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ApplicationComment {
  id: string;
  body: string;
  author: UserSummary;
  created_at: string;
  edited_at: string | null;
}

export interface ApplicationFile {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploader: UserSummary | null;
  uploaded_at: string;
}

export interface ApplicationActivity {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  actor: UserSummary | null;
  created_at: string;
}

export interface ApplicationDetail extends Application {
  comments: ApplicationComment[];
  files: ApplicationFile[];
  activity: ApplicationActivity[];
}

export interface ApplicationList {
  items: Application[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

export interface DashboardSummary {
  new: number;
  in_progress: number;
  unassigned: number;
  total: number;
  recent: Application[];
}
