"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkEnroll,
  createEnrollment,
  fetchEnrollmentPlan,
  fetchEnrollmentCapacity,
  fetchEnrollments,
  fetchUnassignedStudents,
  saveEnrollmentPlan,
  transferEnrollment,
  updateEnrollmentStatus,
} from "./api";
import type { EnrollmentListParams, UnassignedParams } from "./types";

export const enrollmentKeys = {
  all: ["enrollments"] as const,
  lists: () => [...enrollmentKeys.all, "list"] as const,
  list: (params: EnrollmentListParams) => [...enrollmentKeys.lists(), params] as const,
  unassigned: (params: UnassignedParams) => [...enrollmentKeys.all, "unassigned", params] as const,
  plan: (schoolYearId: string) => [...enrollmentKeys.all, "plan", schoolYearId] as const,
  capacity: (schoolYearId: string) => [...enrollmentKeys.all, "capacity", schoolYearId] as const,
};

function useInvalidateEnrollmentSurfaces() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: enrollmentKeys.all }),
      client.invalidateQueries({ queryKey: ["sections"] }),
      client.invalidateQueries({ queryKey: ["class-offerings"] }),
      client.invalidateQueries({ queryKey: ["students"] }),
      client.invalidateQueries({ queryKey: ["me", "classes"] }),
      client.invalidateQueries({ queryKey: ["me", "enrollment"] }),
      client.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };
}

export function useEnrollments(params: EnrollmentListParams, enabled = true) {
  return useQuery({
    queryKey: enrollmentKeys.list(params),
    queryFn: () => fetchEnrollments(params),
    enabled,
  });
}

export function useUnassignedStudents(params: UnassignedParams, enabled = true) {
  return useQuery({
    queryKey: enrollmentKeys.unassigned(params),
    queryFn: () => fetchUnassignedStudents(params),
    enabled,
  });
}

export function useEnrollmentPlan(schoolYearId: string) {
  return useQuery({
    queryKey: enrollmentKeys.plan(schoolYearId),
    queryFn: () => fetchEnrollmentPlan(schoolYearId),
    enabled: Boolean(schoolYearId),
  });
}

export function useEnrollmentCapacity(schoolYearId: string) {
  return useQuery({
    queryKey: enrollmentKeys.capacity(schoolYearId),
    queryFn: () => fetchEnrollmentCapacity(schoolYearId),
    enabled: Boolean(schoolYearId),
  });
}

export function useSaveEnrollmentPlan(schoolYearId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof saveEnrollmentPlan>[1]) => saveEnrollmentPlan(schoolYearId, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: enrollmentKeys.plan(schoolYearId) });
      await client.invalidateQueries({ queryKey: enrollmentKeys.capacity(schoolYearId) });
      await client.invalidateQueries({ queryKey: ["sections"] });
    },
  });
}

export function useCreateEnrollment() {
  const invalidate = useInvalidateEnrollmentSurfaces();
  return useMutation({ mutationFn: createEnrollment, onSuccess: invalidate });
}

export function useBulkEnroll() {
  const invalidate = useInvalidateEnrollmentSurfaces();
  return useMutation({ mutationFn: bulkEnroll, onSuccess: invalidate });
}

export function useTransferEnrollment() {
  const invalidate = useInvalidateEnrollmentSurfaces();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; sectionId: string; effectiveDate: string; reason?: string }) =>
      transferEnrollment(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateEnrollmentStatus() {
  const invalidate = useInvalidateEnrollmentSurfaces();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { status: "ENROLLED" | "DROPPED" | "COMPLETED"; reason?: string } }) =>
      updateEnrollmentStatus(id, input),
    onSuccess: invalidate,
  });
}
