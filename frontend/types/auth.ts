export type Role = "ADMIN" | "TEACHER" | "STUDENT" | "ALUMNI";

export interface AuthProfile {
  type?: "student" | "teacher";
  studentNo?: string;
  employeeNo?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  role: Role;
  mustChangePassword: boolean;
  profile: AuthProfile | null;
}

export interface LoginInput {
  email: string;
  password: string;
}
