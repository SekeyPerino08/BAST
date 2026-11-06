import type { FeedBatch } from "./types.js";

const batches: FeedBatch[] = [
  {
    source: "lms",
    rows: [
      { externalId: "lms-login-001", studentNo: " STU-2025-0002 ", firstName: "  Ben  ", lastName: " Ocampo ", type: "Login", occurredAt: "2026-10-28T08:12:00.000Z" },
      { externalId: "lms-submit-001", email: "ben.ocampo@uni.edu", type: "Submission", occurredAt: "2026-10-29T11:00:00.000Z", onTime: true },
      { externalId: "lms-quiz-001", studentNo: "STU-2025-0002", type: "Quiz", occurredAt: "2026-10-30T09:30:00.000Z", score: 88 },
      { externalId: "lms-unknown-001", studentNo: "STU-UNKNOWN-9999", type: "Login", occurredAt: "2026-10-30T10:00:00.000Z" },
      { externalId: "lms-bad-date-001", studentNo: "STU-2025-0001", type: "Quiz", occurredAt: "not-a-date", score: 91 },
      { externalId: "lms-login-001", studentNo: "STU-2025-0002", type: "Login", occurredAt: "2026-10-28T08:12:00.000Z" },
    ],
  },
  {
    source: "lms",
    rows: [
      { externalId: "lms-next-login-001", email: "student1@school.test", type: "Login", occurredAt: "2026-11-02T08:00:00.000Z" },
      { externalId: "lms-next-submit-001", studentNo: "STU-2025-0001", type: "Submission", occurredAt: "2026-11-03T10:00:00.000Z", onTime: false },
      { externalId: "lms-next-quiz-001", studentNo: "STU-2025-0001", type: "Quiz", occurredAt: "2026-11-04T10:00:00.000Z", score: 77 },
      { externalId: "lms-next-name-001", studentNo: "STU-2025-0003", firstName: "  Carla   Maria ", lastName: " Mendoza ", type: "Login", occurredAt: "2026-11-01T07:45:00.000Z" },
    ],
  },
];

export function getLmsBatch(next = false): FeedBatch {
  const batch = batches[next ? 1 : 0];
  return { ...batch, rows: batch.rows.map((row) => ({ ...row })) };
}
