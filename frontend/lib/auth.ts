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
  lastName?: string;
  profile: { firstName?: string; middleName?: string | null; lastName?: string } | null;
}): string {
  const profileName = [user.profile?.firstName, user.profile?.middleName, user.profile?.lastName]
    .filter(Boolean)
    .join(" ");
  const accountName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return profileName || accountName || user.email;
}
