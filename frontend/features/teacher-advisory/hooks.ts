"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyAdvisees } from "./api";

export const teacherAdvisoryKeys = {
  advisees: ["teacher-advisory", "advisees"] as const,
};

export function useMyAdvisees() {
  return useQuery({
    queryKey: teacherAdvisoryKeys.advisees,
    queryFn: fetchMyAdvisees,
  });
}
