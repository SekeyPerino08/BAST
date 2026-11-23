import { z } from "zod";

export const recoveryExerciseSchema = z.object({
  kind: z.enum(["BACKUP_VERIFICATION", "RESTORE_TEST"]),
  result: z.enum(["PASSED", "FAILED"]),
  testedAt: z.iso.date(),
  notes: z.string().trim().min(10).max(1000),
});

