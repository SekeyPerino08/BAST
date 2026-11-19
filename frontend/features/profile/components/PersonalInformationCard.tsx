"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Camera,
  Check,
  LoaderCircle,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../providers/AuthProvider";
import { useUpdateMyProfile } from "../hooks";
import type { MyProfile } from "../api";
import { PersonalProfileFormInput, PersonalProfileValues, personalProfileSchema } from "../profile.schema";
import { ProfileAvatar } from "./ProfileAvatar";

const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1d6a45] focus:ring-4 focus:ring-[#1d6a45]/10 aria-[invalid=true]:border-rose-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
const profileFieldNames = ["firstName", "middleName", "lastName", "phoneNumber", "dateOfBirth", "sex", "address"] as const;

function toFormValues(profile: MyProfile["personalProfile"]): PersonalProfileFormInput {
  return {
    firstName: profile.firstName,
    middleName: profile.middleName ?? "",
    lastName: profile.lastName,
    phoneNumber: profile.phoneNumber ?? "",
    dateOfBirth: profile.dateOfBirth ?? "",
    sex: profile.sex ?? "",
    address: profile.address ?? "",
  };
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || "U";
}

function formatBirthDate(value: string | null): string {
  if (!value) return "Not provided";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(date);
}

function maxBirthDate(): string {
  const today = new Date();
  const latest = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  latest.setUTCFullYear(latest.getUTCFullYear() - 5);
  return latest.toISOString().slice(0, 10);
}

function serverFieldErrors(error: unknown): Array<{ field: string; message: string }> {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== "object") return [];
  const errors = "errors" in error.details ? error.details.errors : null;
  if (!Array.isArray(errors)) return [];
  return errors.filter(
    (item): item is { field: string; message: string } =>
      typeof item === "object" &&
      item !== null &&
      "field" in item &&
      typeof item.field === "string" &&
      "message" in item &&
      typeof item.message === "string",
  );
}

export function PersonalInformationCard({ profile }: Readonly<{ profile: MyProfile }>) {
  const { refresh } = useAuth();
  const updateProfile = useUpdateMyProfile();
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoPreviewUrl = useRef<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PersonalProfileFormInput, unknown, PersonalProfileValues>({
    resolver: zodResolver(personalProfileSchema),
    defaultValues: toFormValues(profile.personalProfile),
    mode: "onSubmit",
  });
  const currentValues = toFormValues(profile.personalProfile);
  const photoIsDirty = Boolean(photo || removePhoto);
  const hasUnsavedChanges = editing && (isDirty || photoIsDirty);
  const avatarInitials = initials(profile.personalProfile.firstName, profile.personalProfile.lastName);

  useEffect(() => () => {
    if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmLinkNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a");
      if (!link || link.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname) return;
      if (!window.confirm("You have unsaved profile changes. Leave without saving?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [hasUnsavedChanges]);

  const validPhoto = profile.personalProfile.photoUpdatedAt;

  function beginEdit() {
    reset(currentValues);
    setSelectedPhoto(null);
    setRemovePhoto(false);
    setEditing(true);
  }

  function cancelEdit() {
    reset(currentValues);
    setSelectedPhoto(null);
    setRemovePhoto(false);
    setEditing(false);
  }

  function setSelectedPhoto(file: File | null) {
    if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
    photoPreviewUrl.current = file ? URL.createObjectURL(file) : null;
    setPhotoPreview(photoPreviewUrl.current);
    setPhoto(file);
  }

  function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("The profile photo must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }
    setSelectedPhoto(file);
    setRemovePhoto(false);
  }

  async function save(values: PersonalProfileValues) {
    try {
      const savedProfile = await updateProfile.mutateAsync({ values, photo, removePhoto });
      reset(toFormValues(savedProfile));
      setSelectedPhoto(null);
      setRemovePhoto(false);
      setEditing(false);
      await refresh();
      toast.success("Personal profile saved");
    } catch (error) {
      const fieldNames = new Set(["firstName", "middleName", "lastName", "phoneNumber", "dateOfBirth", "sex", "address"]);
      const fieldErrors = serverFieldErrors(error);
      for (const fieldError of fieldErrors) {
        if (fieldNames.has(fieldError.field)) {
          setError(fieldError.field as keyof PersonalProfileFormInput, { type: "server", message: fieldError.message });
        }
      }
      const firstInvalidField = fieldErrors.find((entry) => fieldNames.has(entry.field));
      if (firstInvalidField) setFocus(firstInvalidField.field as keyof PersonalProfileFormInput);
      toast.error(error instanceof ApiError ? error.message : "Could not save your profile. Please try again.");
    }
  }

  function onInvalid(invalidFields: FieldErrors<PersonalProfileFormInput>) {
    const firstInvalid = profileFieldNames.find((name) => invalidFields[name]);
    if (firstInvalid) setFocus(firstInvalid as keyof PersonalProfileFormInput);
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape" && !updateProfile.isPending) {
      event.preventDefault();
      cancelEdit();
    }
  }

  function inputError(name: keyof PersonalProfileFormInput) {
    return errors[name]?.message;
  }

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.08)] sm:p-6 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1d6a45] dark:bg-slate-700 dark:text-[#dfeee4]">
            <CalendarDays size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Personal information</h2>
            <p className="text-xs text-slate-500">Your name and contact details are visible only where needed.</p>
          </div>
        </div>
        {!editing && profile.hasPersonalProfile && (
          <button type="button" onClick={beginEdit} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-[#1d6a45] hover:text-[#0d412e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <Pencil size={15} aria-hidden="true" />
            Edit
          </button>
        )}
      </div>

      {!editing && !profile.hasPersonalProfile ? (
        <div className="mt-5 flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center dark:border-slate-700 dark:bg-slate-800/60">
          <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-[#edf7ef] text-[#1d6a45] dark:bg-slate-700 dark:text-[#dfeee4]">
            <UserRound size={22} aria-hidden="true" />
          </span>
          <h3 className="text-base font-semibold text-slate-900">Complete your personal profile</h3>
          <p className="mt-1 max-w-sm text-sm leading-6 text-slate-600">Add your contact details and other personal information. Your email and role remain unchanged.</p>
          <button type="button" onClick={beginEdit} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0d412e] px-4 text-sm font-semibold text-white transition hover:bg-[#135b3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45]">
            <Pencil size={15} aria-hidden="true" />
            Create personal profile
          </button>
        </div>
      ) : editing ? (
        <form
          className="mt-5 space-y-5"
          noValidate
          onSubmit={(event) => void handleSubmit(save, onInvalid)(event)}
          onKeyDown={handleFormKeyDown}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" name="firstName" required error={inputError("firstName")}>
              <input id="profile-firstName" autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? "profile-firstName-error" : undefined} {...register("firstName")} className={fieldClass} />
            </FormField>
            <FormField label="Middle name" name="middleName" error={inputError("middleName")}>
              <input id="profile-middleName" autoComplete="additional-name" aria-invalid={Boolean(errors.middleName)} aria-describedby={errors.middleName ? "profile-middleName-error" : undefined} {...register("middleName")} className={fieldClass} />
            </FormField>
            <FormField label="Last name" name="lastName" required error={inputError("lastName")}>
              <input id="profile-lastName" autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? "profile-lastName-error" : undefined} {...register("lastName")} className={fieldClass} />
            </FormField>
            <FormField label="Phone number" name="phoneNumber" error={inputError("phoneNumber")} hint="Philippine numbers: 09XXXXXXXXX or +639XXXXXXXXX">
              <input id="profile-phoneNumber" type="tel" inputMode="tel" autoComplete="tel" placeholder="09171234567" aria-invalid={Boolean(errors.phoneNumber)} aria-describedby={errors.phoneNumber ? "profile-phoneNumber-error" : "profile-phoneNumber-hint"} {...register("phoneNumber")} className={fieldClass} />
            </FormField>
            <FormField label="Date of birth" name="dateOfBirth" error={inputError("dateOfBirth")}>
              <input id="profile-dateOfBirth" type="date" max={maxBirthDate()} aria-invalid={Boolean(errors.dateOfBirth)} aria-describedby={errors.dateOfBirth ? "profile-dateOfBirth-error" : undefined} {...register("dateOfBirth")} className={fieldClass} />
            </FormField>
            <FormField label="Gender" name="sex" error={inputError("sex")}>
              <select id="profile-sex" aria-invalid={Boolean(errors.sex)} aria-describedby={errors.sex ? "profile-sex-error" : undefined} {...register("sex")} className={fieldClass}>
                <option value="">Prefer not to say</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
              </select>
            </FormField>
            <FormField label="Address" name="address" error={inputError("address")} className="sm:col-span-2">
              <textarea id="profile-address" rows={3} autoComplete="street-address" aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "profile-address-error" : undefined} {...register("address")} className={`${fieldClass} resize-y`} />
            </FormField>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ProfileAvatar
                initials={avatarInitials}
                photoUpdatedAt={removePhoto ? null : validPhoto}
                photoSrc={photoPreview}
                size={64}
                className="text-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Profile photo <span className="font-normal text-slate-500">(optional)</span></p>
                <p className="mt-1 text-xs leading-5 text-slate-600">JPG, PNG, or WebP, up to 2 MB.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-[#1d6a45] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1d6a45] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                    <Camera size={14} aria-hidden="true" />
                    {photo || validPhoto && !removePhoto ? "Change photo" : "Upload photo"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoSelected} className="sr-only" aria-label="Upload a profile photo" />
                  </label>
                  {(photo || validPhoto && !removePhoto) && (
                    <button type="button" onClick={() => { setSelectedPhoto(null); setRemovePhoto(true); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:text-rose-300 dark:hover:bg-rose-950/40">
                      <Trash2 size={14} aria-hidden="true" />
                      Remove photo
                    </button>
                  )}
                  {removePhoto && (
                    <button type="button" onClick={() => setRemovePhoto(false)} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] dark:text-slate-300 dark:hover:bg-slate-700">
                      Undo remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-700">
            <button type="button" onClick={cancelEdit} disabled={isSubmitting || updateProfile.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <X size={15} aria-hidden="true" />
              Cancel
            </button>
            <button type="submit" disabled={(!isDirty && !photoIsDirty) || isSubmitting || updateProfile.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0d412e] px-5 text-sm font-semibold text-white transition hover:bg-[#135b3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
              {updateProfile.isPending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              {updateProfile.isPending ? "Saving changes…" : "Save changes"}
            </button>
          </div>
          <p className="sr-only" aria-live="polite">{updateProfile.isPending ? "Saving profile changes" : ""}</p>
        </form>
      ) : (
        <div className="mt-5 space-y-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            <ProfileValue label="First name" value={profile.personalProfile.firstName} />
            <ProfileValue label="Middle name" value={profile.personalProfile.middleName} />
            <ProfileValue label="Last name" value={profile.personalProfile.lastName} />
            <ProfileValue label="Phone number" value={profile.personalProfile.phoneNumber} icon={<Phone size={15} aria-hidden="true" />} />
            <ProfileValue label="Date of birth" value={formatBirthDate(profile.personalProfile.dateOfBirth)} icon={<CalendarDays size={15} aria-hidden="true" />} />
            <ProfileValue label="Gender" value={profile.personalProfile.sex === "MALE" ? "Male" : profile.personalProfile.sex === "FEMALE" ? "Female" : null} />
            <ProfileValue label="Address" value={profile.personalProfile.address} icon={<MapPin size={15} aria-hidden="true" />} className="sm:col-span-2" />
          </dl>
          {profile.person && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-700">
              {profile.person.type === "STUDENT" ? (
                <>
                  <span>Student number <strong className="ml-1 font-semibold text-slate-700 dark:text-slate-300">{profile.person.studentNo}</strong></span>
                  <span>Current section <strong className="ml-1 font-semibold text-slate-700 dark:text-slate-300">{profile.person.currentSection ?? "Not enrolled"}</strong></span>
                </>
              ) : (
                <>
                  <span>Employee number <strong className="ml-1 font-semibold text-slate-700 dark:text-slate-300">{profile.person.employeeNo}</strong></span>
                  <span>Department <strong className="ml-1 font-semibold text-slate-700 dark:text-slate-300">{profile.person.department ?? "Not set"}</strong></span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FormField({
  label,
  name,
  required = false,
  error,
  hint,
  className = "",
  children,
}: Readonly<{
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}>) {
  const errorId = `profile-${name}-error`;
  const hintId = `profile-${name}-hint`;
  return (
    <div className={className}>
      <label htmlFor={`profile-${name}`} className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {label}{required && <span className="ml-1 text-rose-600" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> required</span>}
      </label>
      {children}
      {hint && !error && <p id={hintId} className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={errorId} role="alert" className="mt-1 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  );
}

function ProfileValue({
  label,
  value,
  icon,
  className = "",
}: Readonly<{ label: string; value: string | null; icon?: React.ReactNode; className?: string }>) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60 ${className}`}>
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-slate-900 dark:text-slate-100">{value || <span className="font-normal text-slate-400">Not provided</span>}</dd>
    </div>
  );
}
