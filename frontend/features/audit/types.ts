import type { Role } from "../../types/auth";

export interface AuditActor {
  id: string;
  email: string;
  role: Role | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  entityType: string;
  entityId: string | null;
  studentId: string | null;
  ip: string | null;
  actor: AuditActor | null;
  before: unknown;
  after: unknown;
}

export interface AuditResponse {
  data: AuditEntry[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface AuditParams {
  page: number;
  pageSize: number;
  action?: string;
  entity_type?: string;
  actor?: string;
  student?: string;
  from?: string;
  to?: string;
}

export interface AuditFacets {
  actions: string[];
  entities: string[];
}
