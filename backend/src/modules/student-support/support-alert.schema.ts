import { StudentSupportAlertStatus } from "@prisma/client";
import { z } from "zod";

export const updateSupportAlertSchema = z.object({
  status: z.nativeEnum(StudentSupportAlertStatus),
  followUpNote: z.string().trim().max(1000).nullable(),
});

