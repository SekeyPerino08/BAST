"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchClassGradeSheet,
  fetchMyGrades,
  fetchTermGradeCompleteness,
  saveClassGrades,
  setTermLocked,
  setTermReleased,
} from "./api";

export const gradeKeys = {
  all: ["grades"] as const,
  sheet: (classOfferingId: string) => [...gradeKeys.all, "sheet", classOfferingId] as const,
  me: (params: { schoolYearId?: string } = {}) => [...gradeKeys.all, "me", params] as const,
  completeness: (schoolYearId: string, termId: string) => [...gradeKeys.all, "completeness", schoolYearId, termId] as const,
};

export function useClassGradeSheet(classOfferingId: string) {
  return useQuery({
    queryKey: gradeKeys.sheet(classOfferingId),
    queryFn: () => fetchClassGradeSheet(classOfferingId),
    enabled: Boolean(classOfferingId),
  });
}

export function useMyGrades(params: { schoolYearId?: string } = {}) {
  return useQuery({
    queryKey: gradeKeys.me(params),
    queryFn: () => fetchMyGrades(params),
    placeholderData: (previous) => previous,
  });
}

export function useSaveClassGrades(classOfferingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof saveClassGrades>[1]) => saveClassGrades(classOfferingId, input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: gradeKeys.all }),
        client.invalidateQueries({ queryKey: ["report-card"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}

export function useTermGradeCompleteness(schoolYearId: string, termId: string, enabled: boolean) {
  return useQuery({
    queryKey: gradeKeys.completeness(schoolYearId, termId),
    queryFn: () => fetchTermGradeCompleteness(schoolYearId, termId),
    enabled: Boolean(schoolYearId && termId && enabled),
  });
}

function useTermMutation(
  mutationFn: (args: { schoolYearId: string; termId: string; value: boolean; reason?: string }) => Promise<unknown>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["school-years"] }),
        client.invalidateQueries({ queryKey: gradeKeys.all }),
        client.invalidateQueries({ queryKey: ["report-card"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}

export function useSetTermLocked() {
  return useTermMutation(({ schoolYearId, termId, value, reason }) =>
    setTermLocked(schoolYearId, termId, value, reason));
}

export function useSetTermReleased() {
  return useTermMutation(({ schoolYearId, termId, value, reason }) =>
    setTermReleased(schoolYearId, termId, value, reason));
}
