"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyProfile, updateMyProfile, type MyProfile } from "./api";
import type { PersonalProfileValues } from "./profile.schema";

export function useMyProfile() {
  return useQuery({ queryKey: ["my-profile"], queryFn: fetchMyProfile });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { values: PersonalProfileValues; photo: File | null; removePhoto: boolean }) =>
      updateMyProfile(input.values, input.photo, input.removePhoto),
    onSuccess: (personalProfile) => {
      queryClient.setQueryData<MyProfile>(["my-profile"], (current) =>
        current ? {
          ...current,
          personalProfile,
          hasPersonalProfile: true,
          person: current.person
            ? {
                ...current.person,
                fullName: [personalProfile.firstName, personalProfile.middleName, personalProfile.lastName]
                  .filter(Boolean)
                  .join(" "),
                ...(current.person.type === "TEACHER" ? { contactNo: personalProfile.phoneNumber } : {}),
              }
            : current.person,
        } : current,
      );
    },
  });
}
