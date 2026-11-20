import { apiFetch } from "../../lib/api";
import type { Role } from "../../types/auth";
import type { PersonalProfileValues } from "./profile.schema";

export interface PersonalProfile extends PersonalProfileValues {
  photoUpdatedAt: string | null;
}

export interface MyProfile {
  user: {
    email: string;
    role: Role;
    createdAt: string;
    lastLoginAt: string | null;
    passwordChangedAt: string | null;
  };
  person:
    | { type: "STUDENT"; studentNo: string; fullName: string; currentSection: string | null }
    | { type: "TEACHER"; employeeNo: string; fullName: string; department: string | null; contactNo: string | null }
    | null;
  personalProfile: PersonalProfile;
  hasPersonalProfile: boolean;
}

export function fetchMyProfile() {
  return apiFetch<MyProfile>("/api/me/profile");
}

export function updateMyProfile(
  values: PersonalProfileValues,
  photo: File | null,
  removePhoto: boolean,
) {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) {
    body.append(key, value === null ? "" : String(value));
  }
  body.append("removePhoto", String(removePhoto));
  if (photo) body.append("photo", photo);
  return apiFetch<PersonalProfile>("/api/me/profile", { method: "PATCH", body });
}
