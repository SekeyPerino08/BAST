import "dotenv/config";
import {
  AdmissionStage,
  AnnouncementCategory,
  DocumentRequestStatus,
  DocumentRequestType,
  EnrollmentStatus,
  FeedImportMode,
  ImportStatus,
  ImportType,
  NotificationType,
  Prisma,
  PrismaClient,
  Role,
  SeniorHighStrand,
  Sex,
  StudentStatus,
  StudentSupportAlertRule,
  StudentSupportAlertStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const schoolYearName = "2026-2027";
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

function assertSafeTarget() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled when NODE_ENV=production.");
  }
  if (process.env.ALLOW_DEMO_SEED_2026_2027 !== "YES") {
    throw new Error("Set ALLOW_DEMO_SEED_2026_2027=YES to confirm demo data should be written.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  const hostname = new URL(databaseUrl).hostname;
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(hostname) && process.env.ALLOW_REMOTE_DEMO_SEED !== "YES") {
    throw new Error("Remote database seeding is blocked. Set ALLOW_REMOTE_DEMO_SEED=YES only for a disposable development database.");
  }
}

async function seedDemoData() {
  assertSafeTarget();

  await prisma.schoolYear.updateMany({
    where: { name: { not: schoolYearName } },
    data: { isCurrent: false },
  });
  const schoolYear = await prisma.schoolYear.upsert({
    where: { name: schoolYearName },
    update: {
      startDate: date("2026-06-01"),
      endDate: date("2027-03-31"),
      isCurrent: true,
    },
    create: {
      name: schoolYearName,
      startDate: date("2026-06-01"),
      endDate: date("2027-03-31"),
      isCurrent: true,
    },
  });

  const termDates = [
    ["2026-06-01", "2026-08-31"],
    ["2026-09-01", "2026-11-30"],
    ["2026-12-01", "2027-01-31"],
    ["2027-02-01", "2027-03-31"],
  ] as const;
  for (const [index, [startDate, endDate]] of termDates.entries()) {
    await prisma.term.upsert({
      where: { schoolYearId_termNumber: { schoolYearId: schoolYear.id, termNumber: index + 1 } },
      update: {
        name: `${["1st", "2nd", "3rd", "4th"][index]} Quarter`,
        startDate: date(startDate),
        endDate: date(endDate),
      },
      create: {
        schoolYearId: schoolYear.id,
        name: `${["1st", "2nd", "3rd", "4th"][index]} Quarter`,
        termNumber: index + 1,
        startDate: date(startDate),
        endDate: date(endDate),
      },
    });
  }

  const adminUsers = await prisma.user.findMany({
    where: { role: Role.ADMIN, isActive: true },
    select: { id: true },
  });
  const adminId = adminUsers[0]?.id ?? null;

  const requirements = [
    { category: "NEW", name: "Birth certificate", required: true },
    { category: "NEW", name: "Previous report card", required: true },
    { category: "RETURNING", name: "Updated student information", required: true },
  ];
  const specialPolicies = {
    transfers: "Demo policy: submit transfer records for review.",
    scholarships: "Demo policy: scholarship applications are reviewed by the school office.",
    support: "Demo policy: contact the school for learning support.",
    international: "Demo policy: international records require evaluation.",
    lateApplicants: "Demo policy: late applications are reviewed as space allows.",
  };
  const plan = await prisma.enrollmentPlan.upsert({
    where: { schoolYearId: schoolYear.id },
    update: {
      registrationOpensAt: date("2026-01-15"),
      registrationClosesAt: date("2026-05-30"),
      firstDayOfClasses: date("2026-06-01"),
      modality: "HYBRID",
      paymentMethod: "CASH",
      requirements,
      specialPolicies,
    },
    create: {
      schoolYearId: schoolYear.id,
      registrationOpensAt: date("2026-01-15"),
      registrationClosesAt: date("2026-05-30"),
      firstDayOfClasses: date("2026-06-01"),
      modality: "HYBRID",
      paymentMethod: "CASH",
      requirements,
      specialPolicies,
    },
  });

  for (const gradeLevel of [7, 8, 9, 10]) {
    await prisma.enrollmentGradeTarget.upsert({
      where: { planId_gradeLevel: { planId: plan.id, gradeLevel } },
      update: { expectedNew: 2, expectedReturning: 2, plannedSections: 1 },
      create: { planId: plan.id, gradeLevel, expectedNew: 2, expectedReturning: 2, plannedSections: 1 },
    });
  }
  for (const gradeLevel of [11, 12]) {
    for (const strand of Object.values(SeniorHighStrand)) {
      await prisma.enrollmentStrandTarget.upsert({
        where: { planId_gradeLevel_strand: { planId: plan.id, gradeLevel, strand } },
        update: { expectedNew: 2, expectedReturning: 1, plannedSections: 1 },
        create: { planId: plan.id, gradeLevel, strand, expectedNew: 2, expectedReturning: 1, plannedSections: 1 },
      });
    }
  }

  const sectionRows = await Promise.all([7, 8, 9, 10].map(async (gradeLevel) => ({
    gradeLevel,
    section: await prisma.section.upsert({
      where: {
        schoolYearId_gradeLevel_name: {
          schoolYearId: schoolYear.id,
          gradeLevel,
          name: `Demo ${gradeLevel}-A`,
        },
      },
      update: { capacity: 30, strand: null },
      create: {
        schoolYearId: schoolYear.id,
        gradeLevel,
        name: `Demo ${gradeLevel}-A`,
        capacity: 30,
      },
    }),
  })));
  const sectionByGrade = new Map(sectionRows.map(({ gradeLevel, section }) => [gradeLevel, section]));

  const studentSpecs = [
    { studentNo: "DEMO-2627-07-001", firstName: "Mika", lastName: "Santos", sex: Sex.FEMALE, gradeLevel: 7 },
    { studentNo: "DEMO-2627-07-002", firstName: "Paolo", lastName: "Reyes", sex: Sex.MALE, gradeLevel: 7 },
    { studentNo: "DEMO-2627-08-001", firstName: "Lia", lastName: "Garcia", sex: Sex.FEMALE, gradeLevel: 8 },
    { studentNo: "DEMO-2627-08-002", firstName: "Noah", lastName: "Cruz", sex: Sex.MALE, gradeLevel: 8 },
    { studentNo: "DEMO-2627-09-001", firstName: "Aira", lastName: "Mendoza", sex: Sex.FEMALE, gradeLevel: 9 },
    { studentNo: "DEMO-2627-09-002", firstName: "Enzo", lastName: "Ramos", sex: Sex.MALE, gradeLevel: 9 },
    { studentNo: "DEMO-2627-10-001", firstName: "Tala", lastName: "Navarro", sex: Sex.FEMALE, gradeLevel: 10 },
    { studentNo: "DEMO-2627-10-002", firstName: "Luis", lastName: "Flores", sex: Sex.MALE, gradeLevel: 10 },
  ] as const;
  const demoStudents = await Promise.all(studentSpecs.map((student) => prisma.student.upsert({
    where: { studentNo: student.studentNo },
    update: {
      firstName: student.firstName,
      lastName: student.lastName,
      sex: student.sex,
      status: StudentStatus.ACTIVE,
    },
    create: {
      studentNo: student.studentNo,
      firstName: student.firstName,
      lastName: student.lastName,
      sex: student.sex,
      status: StudentStatus.ACTIVE,
    },
  })));
  const gradeByStudentId = new Map(demoStudents.map((student, index) => [student.id, studentSpecs[index].gradeLevel]));
  const linkedStudent = await prisma.student.findFirst({
    where: {
      status: StudentStatus.ACTIVE,
      user: { is: { role: Role.STUDENT, isActive: true } },
    },
    orderBy: { studentNo: "asc" },
    select: { id: true, studentNo: true, firstName: true, lastName: true, userId: true },
  });

  for (const [index, student] of demoStudents.entries()) {
    const gradeLevel = studentSpecs[index].gradeLevel;
    const section = sectionByGrade.get(gradeLevel);
    if (!section) throw new Error(`Missing seeded Grade ${gradeLevel} section.`);
    await prisma.enrollment.upsert({
      where: { studentId_schoolYearId: { studentId: student.id, schoolYearId: schoolYear.id } },
      update: { sectionId: section.id, status: EnrollmentStatus.ENROLLED },
      create: {
        studentId: student.id,
        schoolYearId: schoolYear.id,
        sectionId: section.id,
        status: EnrollmentStatus.ENROLLED,
      },
    });
  }
  if (linkedStudent) {
    const section = sectionByGrade.get(7);
    if (!section) throw new Error("Missing seeded Grade 7 section.");
    await prisma.enrollment.upsert({
      where: { studentId_schoolYearId: { studentId: linkedStudent.id, schoolYearId: schoolYear.id } },
      update: { sectionId: section.id, status: EnrollmentStatus.ENROLLED },
      create: {
        studentId: linkedStudent.id,
        schoolYearId: schoolYear.id,
        sectionId: section.id,
        status: EnrollmentStatus.ENROLLED,
      },
    });
    gradeByStudentId.set(linkedStudent.id, 7);
  }

  const subjectRows = await Promise.all([7, 8, 9, 10].map(async (gradeLevel) => ({
    gradeLevel,
    subject: await prisma.subject.upsert({
      where: { code: `DEMO2627-ENG-${gradeLevel}` },
      update: { name: `Demo English ${gradeLevel}`, gradeLevel },
      create: { code: `DEMO2627-ENG-${gradeLevel}`, name: `Demo English ${gradeLevel}`, gradeLevel },
    }),
  })));
  const subjectByGrade = new Map(subjectRows.map(({ gradeLevel, subject }) => [gradeLevel, subject]));
  const scheduleStudents = linkedStudent
    ? [...demoStudents, linkedStudent]
    : demoStudents;
  for (const student of scheduleStudents) {
    const gradeLevel = gradeByStudentId.get(student.id) ?? 7;
    const section = sectionByGrade.get(gradeLevel);
    const subject = subjectByGrade.get(gradeLevel);
    if (!section || !subject) throw new Error(`Missing seeded class data for Grade ${gradeLevel}.`);
    const scheduleData = {
      studentId: student.id,
      sectionId: section.id,
      subjectId: subject.id,
      schoolYearId: schoolYear.id,
      dayOfWeek: "Monday",
      startTime: "08:00",
      endTime: "08:50",
      room: `Room ${gradeLevel}A`,
      notes: "Demo schedule for 2026-2027.",
      isActive: true,
    };
    await prisma.classSchedule.upsert({
      where: { id: `seed-2627-schedule-${student.id}` },
      update: scheduleData,
      create: { id: `seed-2627-schedule-${student.id}`, ...scheduleData },
    });
  }

  const alertSeeds = [
    {
      student: demoStudents[0],
      rule: StudentSupportAlertRule.ATTENDANCE,
      status: StudentSupportAlertStatus.IN_PROGRESS,
      summary: "Demo: attendance needs follow-up",
      evidence: { active: true, present: 15, late: 2, absent: 5, rate: 77.3, windowDays: 30 },
      followUpNote: "Demo follow-up: adviser check-in scheduled.",
    },
    {
      student: demoStudents[2],
      rule: StudentSupportAlertRule.LOW_GRADE,
      status: StudentSupportAlertStatus.NOT_STARTED,
      summary: "Demo: latest released average is below passing",
      evidence: { active: true, term: "1st Quarter", average: 64, passingGrade: 75 },
      followUpNote: null,
    },
    {
      student: demoStudents[4],
      rule: StudentSupportAlertRule.DECLINING_GRADE,
      status: StudentSupportAlertStatus.NOT_STARTED,
      summary: "Demo: term average declined",
      evidence: { active: true, previousTerm: "1st Quarter", previousAverage: 88, latestTerm: "2nd Quarter", latestAverage: 78 },
      followUpNote: null,
    },
    {
      student: demoStudents[6],
      rule: StudentSupportAlertRule.ATTENDANCE,
      status: StudentSupportAlertStatus.RESOLVED,
      summary: "Demo: resolved attendance concern",
      evidence: { active: false, present: 20, late: 1, absent: 1, rate: 95.5, windowDays: 30 },
      followUpNote: "Demo follow-up: attendance improved after check-in.",
    },
  ];
  for (const alert of alertSeeds) {
    await prisma.studentSupportAlert.upsert({
      where: {
        studentId_schoolYearId_rule: {
          studentId: alert.student.id,
          schoolYearId: schoolYear.id,
          rule: alert.rule,
        },
      },
      update: {
        status: alert.status,
        summary: alert.summary,
        evidence: alert.evidence,
        followUpNote: alert.followUpNote,
      },
      create: {
        studentId: alert.student.id,
        schoolYearId: schoolYear.id,
        rule: alert.rule,
        status: alert.status,
        summary: alert.summary,
        evidence: alert.evidence,
        followUpNote: alert.followUpNote,
      },
    });
  }

  const checklist = [
    { id: "birth-certificate", name: "Birth certificate", required: true, received: true },
    { id: "previous-report-card", name: "Previous report card", required: true, received: true },
  ];
  const applicants = [
    {
      id: "seed-2627-applicant-documents",
      firstName: "Demo",
      middleName: null,
      lastName: "Applicant",
      gradeLevel: 8,
      strand: null,
      stage: AdmissionStage.DOCUMENT_COLLECTION,
      documents: checklist.map((document) => ({ ...document, received: false })),
    },
    {
      id: "seed-2627-applicant-review",
      firstName: "Jordan",
      middleName: null,
      lastName: "Sample",
      gradeLevel: 10,
      strand: null,
      stage: AdmissionStage.REVIEW,
      documents: checklist,
    },
    {
      id: "seed-2627-applicant-accepted",
      firstName: "Riley",
      middleName: null,
      lastName: "Example",
      gradeLevel: 11,
      strand: SeniorHighStrand.STEM,
      stage: AdmissionStage.ACCEPTED,
      documents: checklist,
    },
  ];
  for (const applicant of applicants) {
    await prisma.applicant.upsert({
      where: { id: applicant.id },
      update: { ...applicant, schoolYearId: schoolYear.id, guardianName: "Demo Guardian", guardianContact: "09170000000" },
      create: {
        ...applicant,
        schoolYearId: schoolYear.id,
        guardianName: "Demo Guardian",
        guardianContact: "09170000000",
      },
    });
  }

  const now = new Date();
  const announcements = [
    {
      id: "seed-2627-announcement-welcome",
      title: "Demo: Welcome to School Year 2026-2027",
      body: "This sample announcement demonstrates school-wide updates in the student portal.",
      isPinned: true,
    },
    {
      id: "seed-2627-announcement-enrollment",
      title: "Demo: Enrollment information",
      body: "Please review the sample enrollment requirements and contact the school office with questions.",
      isPinned: false,
    },
  ];
  for (const announcement of announcements) {
    await prisma.announcement.upsert({
      where: { id: announcement.id },
      update: {
        ...announcement,
        category: AnnouncementCategory.SCHOOL,
        publishedAt: now,
        expiresAt: date("2027-03-31"),
        createdById: adminId,
        attachments: [],
      },
      create: {
        ...announcement,
        category: AnnouncementCategory.SCHOOL,
        publishedAt: now,
        expiresAt: date("2027-03-31"),
        createdById: adminId,
        attachments: [],
      },
    });
  }

  const pendingRequestId = "seed-2627-document-request-pending";
  await prisma.documentRequest.upsert({
    where: { id: pendingRequestId },
    update: {
      studentId: demoStudents[0].id,
      documentType: DocumentRequestType.CERTIFICATE_OF_ENROLLMENT,
      reason: "Demo request for school records",
      details: "Seed record for the 2026-2027 workflow.",
      status: DocumentRequestStatus.PENDING,
      requestedAt: now,
      processedAt: null,
      adminRemarks: null,
    },
    create: {
      id: pendingRequestId,
      studentId: demoStudents[0].id,
      documentType: DocumentRequestType.CERTIFICATE_OF_ENROLLMENT,
      reason: "Demo request for school records",
      details: "Seed record for the 2026-2027 workflow.",
      status: DocumentRequestStatus.PENDING,
      requestedAt: now,
    },
  });
  const approvedRequestStudent = linkedStudent ?? demoStudents[1];
  const approvedRequestId = "seed-2627-document-request-approved";
  await prisma.documentRequest.upsert({
    where: { id: approvedRequestId },
    update: {
      studentId: approvedRequestStudent.id,
      documentType: DocumentRequestType.REPORT_CARD,
      reason: "Demo request for a report card",
      details: "Seed record for the 2026-2027 workflow.",
      status: DocumentRequestStatus.APPROVED,
      requestedAt: now,
      processedAt: now,
      adminRemarks: "Demo: this request has been accepted.",
    },
    create: {
      id: approvedRequestId,
      studentId: approvedRequestStudent.id,
      documentType: DocumentRequestType.REPORT_CARD,
      reason: "Demo request for a report card",
      details: "Seed record for the 2026-2027 workflow.",
      status: DocumentRequestStatus.APPROVED,
      requestedAt: now,
      processedAt: now,
      adminRemarks: "Demo: this request has been accepted.",
    },
  });
  await prisma.documentRequest.upsert({
    where: { id: "seed-2627-document-request-ready" },
    update: {
      studentId: demoStudents[2].id,
      documentType: DocumentRequestType.CERTIFICATE_OF_GOOD_MORAL_CHARACTER,
      reason: "Demo request for a certificate",
      details: "Seed record for the 2026-2027 workflow.",
      status: DocumentRequestStatus.READY_FOR_PICKUP,
      requestedAt: now,
      processedAt: now,
      adminRemarks: "Demo: ready for pickup at the school office.",
    },
    create: {
      id: "seed-2627-document-request-ready",
      studentId: demoStudents[2].id,
      documentType: DocumentRequestType.CERTIFICATE_OF_GOOD_MORAL_CHARACTER,
      reason: "Demo request for a certificate",
      details: "Seed record for the 2026-2027 workflow.",
      status: DocumentRequestStatus.READY_FOR_PICKUP,
      requestedAt: now,
      processedAt: now,
      adminRemarks: "Demo: ready for pickup at the school office.",
    },
  });

  for (const admin of adminUsers) {
    const notificationId = `seed-2627-admin-notification-${admin.id}`;
    const data = {
      userId: admin.id,
      type: NotificationType.DOCUMENT,
      title: "Demo: 2026-2027 document request",
      message: "A sample student document request is waiting for review.",
      actionUrl: "/admin/document-requests",
    };
    await prisma.notification.upsert({
      where: { id: notificationId },
      update: data,
      create: { id: notificationId, ...data },
    });
  }
  if (linkedStudent?.userId) {
    const data = {
      userId: linkedStudent.userId,
      studentId: linkedStudent.id,
      type: NotificationType.DOCUMENT,
      title: "Demo: document request accepted",
      message: "Your sample report card request for 2026-2027 has been accepted.",
      actionUrl: "/student/documents",
    };
    await prisma.notification.upsert({
      where: { id: "seed-2627-student-notification" },
      update: data,
      create: { id: "seed-2627-student-notification", ...data },
    });
  } else {
    console.log("No active student account was found; skipped the sample student notification.");
  }

  const feedRuns = [
    { id: "seed-2627-feed-lms", source: "lms", received: 3, accepted: 2, rejected: 1 },
    { id: "seed-2627-feed-library", source: "library", received: 2, accepted: 2, rejected: 0 },
    { id: "seed-2627-feed-alumni", source: "alumni", received: 1, accepted: 1, rejected: 0 },
  ];
  for (const run of feedRuns) {
    await prisma.feedImportRun.upsert({
      where: { id: run.id },
      update: {
        source: run.source,
        mode: FeedImportMode.PREVIEW,
        startedAt: now,
        finishedAt: now,
        received: run.received,
        accepted: run.accepted,
        rejected: run.rejected,
        runById: adminId,
      },
      create: {
        ...run,
        mode: FeedImportMode.PREVIEW,
        startedAt: now,
        finishedAt: now,
        runById: adminId,
      },
    });
  }
  await prisma.feedImportReject.upsert({
    where: { runId_rowNumber: { runId: "seed-2627-feed-lms", rowNumber: 3 } },
    update: {
      raw: { studentNo: "DEMO-MISSING-2627", externalId: "DEMO-LMS-REJECT-2627" },
      reason: "Demo rejected row: student number did not match a record.",
    },
    create: {
      runId: "seed-2627-feed-lms",
      rowNumber: 3,
      raw: { studentNo: "DEMO-MISSING-2627", externalId: "DEMO-LMS-REJECT-2627" },
      reason: "Demo rejected row: student number did not match a record.",
    },
  });

  const importJobData = {
    type: ImportType.STUDENTS,
    status: ImportStatus.DISCARDED,
    fileName: "2026-2027-demo-students.csv",
    fileHash: "seed-demo-2026-2027",
    options: {
      schoolYearId: schoolYear.id,
      recognizedColumns: [
        { column: "Student No.", field: "studentNo" },
        { column: "First Name", field: "firstName" },
        { column: "Last Name", field: "lastName" },
      ],
      ignoredColumns: [],
      willEnroll: false,
    },
    totals: { totalRows: 3, validRows: 2, warningRows: 0, errorRows: 1 },
    rows: Prisma.DbNull,
    expiresAt: date("2027-03-31"),
    createdById: adminId,
    committedAt: null,
  };
  await prisma.importJob.upsert({
    where: { id: "seed-2627-import-job" },
    update: importJobData,
    create: { id: "seed-2627-import-job", ...importJobData },
  });

  console.log([
    `Current school year set to ${schoolYear.name}.`,
    `Seeded ${demoStudents.length} demo Grade 7-10 students, sections, and enrollments.`,
    `Seeded enrollment targets, admission applicants, support alerts, document requests, announcements, and schedules.`,
    `Seeded notifications for ${adminUsers.length} active admin account(s)${linkedStudent?.userId ? " and one active student account" : ""}.`,
    "Seeded integration feed runs and an import history record.",
  ].join("\n"));
}

seedDemoData()
  .catch((error: unknown) => {
    console.error("2026-2027 demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
