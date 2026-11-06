import type { Role } from "../types/auth";

export function dashboardPath(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    case "STUDENT":
      return "/student";
    case "ALUMNI":
      return "/alumni";
  }
}

export function userDisplayName(user: {
  email: string;
  firstName?: string;
  profile: { firstName?: string; lastName?: string } | null;
}): string {
  return user.profile?.firstName || user.firstName || user.email;
}
