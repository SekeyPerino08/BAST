import type { FeedBatch } from "./types.js";

const batches: FeedBatch[] = [
  {
    source: "alumni",
    rows: [
      { externalId: "alumni-donation-001", studentNo: "STU-2025-0009", firstName: "  Iris  ", lastName: " Navarro ", kind: "Donation", amount: 2500, occurredOn: "2026-10-10", detail: "Library fund" },
      { externalId: "alumni-event-001", email: "iris.co@uni.edu", kind: "Event", occurredOn: "2026-10-20", detail: "Career day guest" },
      { externalId: "alumni-active-001", studentNo: "STU-2025-0002", kind: "Mentoring", occurredOn: "2026-10-22", detail: "Should not be accepted" },
      { externalId: "alumni-negative-001", studentNo: "STU-2025-0009", kind: "Donation", amount: -50, occurredOn: "2026-10-21" },
      { externalId: "alumni-donation-001", studentNo: "STU-2025-0009", kind: "Donation", amount: 2500, occurredOn: "2026-10-10" },
    ],
  },
  {
    source: "alumni",
    rows: [
      { externalId: "alumni-next-event-001", studentNo: "STU-2025-0009", kind: "Event", occurredOn: "2026-11-03", detail: "  Alumni   gathering " },
      { externalId: "alumni-next-mentor-001", email: "iris.co@uni.edu", kind: "Mentoring", occurredOn: "2026-11-04", detail: "Career mentorship" },
    ],
  },
];

export function getAlumniBatch(next = false): FeedBatch {
  const batch = batches[next ? 1 : 0];
  return { ...batch, rows: batch.rows.map((row) => ({ ...row })) };
}
