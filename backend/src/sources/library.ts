import type { FeedBatch } from "./types.js";

const batches: FeedBatch[] = [
  {
    source: "library",
    rows: [
      { externalId: "lib-loan-001", studentNo: "STU-2025-0002", bookTitle: "The Little Prince", loanedOn: "2026-10-01", dueOn: "2026-10-15", returnedOn: null },
      { externalId: "lib-loan-002", email: "student1@school.test", bookTitle: "Philippine History", loanedOn: "2026-10-10", dueOn: "2026-11-10", returnedOn: null },
      { externalId: "lib-bad-dates-001", studentNo: "STU-2025-0001", bookTitle: "A Date Error", loanedOn: "2026-10-20", dueOn: "2026-10-19" },
      { externalId: "lib-unknown-001", studentNo: "STU-UNKNOWN-9999", bookTitle: "Unknown Reader", loanedOn: "2026-10-05", dueOn: "2026-10-19" },
      { externalId: "lib-loan-001", studentNo: "STU-2025-0002", bookTitle: "The Little Prince", loanedOn: "2026-10-01", dueOn: "2026-10-15", returnedOn: null },
    ],
  },
  {
    source: "library",
    rows: [
      { externalId: "lib-next-loan-001", studentNo: "STU-2025-0003", bookTitle: "  Science   Atlas ", loanedOn: "2026-11-01", dueOn: "2026-11-14" },
      { externalId: "lib-next-loan-002", email: "ben.ocampo@uni.edu", bookTitle: "Returned Stories", loanedOn: "2026-09-10", dueOn: "2026-09-24", returnedOn: "2026-09-20" },
    ],
  },
];

export function getLibraryBatch(next = false): FeedBatch {
  const batch = batches[next ? 1 : 0];
  return { ...batch, rows: batch.rows.map((row) => ({ ...row })) };
}
