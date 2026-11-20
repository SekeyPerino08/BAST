import {
  AnnouncementCategory,
  AssignmentStatus,
  AttendanceStatus,
  DocumentRequestStatus,
  DocumentRequestType,
  EnrollmentStatus,
  NotificationType,
} from "@prisma/client";
import type { Request } from "express";
import { audit } from "../../audit.js";
import { prisma } from "../../lib/prisma.js";
import { getTeacherIdForUser } from "../../services/access.service.js";
import { AppError } from "../../utils/AppError.js";
import { formatDateString, parseDateString } from "../../utils/dates.js";
import { calculateAttendanceRate } from "../attendance/attendance.rules.js";
import { getCurrentContext } from "../dashboard/dashboard.helpers.js";
import { myClassesQuerySchema } from "./me.schema.js";
import type { UpdateMyProfileInput } from "./me.schema.js";

async function resolveSchoolYearId(schoolYearId?: string): Promise<string> {
  if (schoolYearId) {
    const year = await prisma.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true } });
    if (!year) throw new AppError("School year not found", 404);
    return year.id;
  }
  const current = await prisma.schoolYear.findFirst({ where: { isCurrent: true }, select: { id: true } });
  if (!current) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
  return current.id;
}

export async function getMyClasses(userId: string, rawQuery: unknown) {
  const parsed = myClassesQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  }
  const [teacherId, schoolYearId] = await Promise.all([
    getTeacherIdForUser(userId),
    resolveSchoolYearId(parsed.data.schoolYearId),
  ]);
  const [classOfferings, advisedSection] = await Promise.all([
    prisma.classOffering.findMany({
      where: { teacherId, schoolYearId },
      orderBy: [{ section: { gradeLevel: "asc" } }, { section: { name: "asc" } }, { subject: { name: "asc" } }],
      include: {
        subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
        section: {
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            _count: {
              select: {
                enrollments: {
                  where: { schoolYearId, status: EnrollmentStatus.ENROLLED },
                },
              },
            },
          },
        },
      },
    }),
    prisma.section.findFirst({
      where: { adviserId: teacherId, schoolYearId },
      select: { id: true, name: true, gradeLevel: true, schoolYear: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    data: classOfferings.map(({ section, ...offering }) => ({
      ...offering,
      section: { id: section.id, name: section.name, gradeLevel: section.gradeLevel },
      enrolledStudentCount: section._count.enrollments,
    })),
    advisedSection,
  };
}

export async function getMyAdvisoryStudents(userId: string) {
  const [teacherId, context] = await Promise.all([
    getTeacherIdForUser(userId),
    getCurrentContext(),
  ]);
  const schoolYear = context.schoolYear;
  const currentTerm = context.currentTerm;
  const recentGradeTerm = schoolYear?.terms
    .filter((term) => term.gradesReleasedAt !== null)
    .at(-1) ?? null;
  const attendancePeriod = currentTerm
    ? {
        from: formatDateString(currentTerm.startDate),
        to: formatDateString(currentTerm.endDate),
      }
    : null;

  const section = schoolYear
    ? await prisma.section.findFirst({
        where: { adviserId: teacherId, schoolYearId: schoolYear.id },
        select: { id: true, name: true, gradeLevel: true },
      })
    : null;

  if (!schoolYear || !section) {
    return {
      schoolYear: schoolYear ? { id: schoolYear.id, name: schoolYear.name } : null,
      section,
      currentTerm: currentTerm ? { id: currentTerm.id, name: currentTerm.name } : null,
      attendancePeriod,
      recentGradeTerm: recentGradeTerm ? { id: recentGradeTerm.id, name: recentGradeTerm.name } : null,
      students: [],
    };
  }

  const [students, offerings] = await Promise.all([
    prisma.student.findMany({
      where: {
        enrollments: {
          some: {
            sectionId: section.id,
            schoolYearId: schoolYear.id,
            status: EnrollmentStatus.ENROLLED,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true },
    }),
    prisma.classOffering.findMany({
      where: { sectionId: section.id, schoolYearId: schoolYear.id },
      select: {
        id: true,
        teacherId: true,
        subject: { select: { id: true, code: true, name: true } },
      },
    }),
  ]);
  const studentIds = students.map(({ id }) => id);
  const offeringIds = offerings.map(({ id }) => id);
  const attendanceDateRange = currentTerm
    ? {
        gte: parseDateString(formatDateString(currentTerm.startDate)),
        lte: parseDateString(formatDateString(currentTerm.endDate)),
      }
    : undefined;
  const [attendanceGroups, grades] = await Promise.all([
    attendanceDateRange && studentIds.length && offeringIds.length
      ? prisma.attendance.groupBy({
          by: ["studentId", "status"],
          where: {
            studentId: { in: studentIds },
            classOfferingId: { in: offeringIds },
            date: attendanceDateRange,
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    recentGradeTerm && studentIds.length && offeringIds.length
      ? prisma.grade.findMany({
          where: {
            studentId: { in: studentIds },
            classOfferingId: { in: offeringIds },
            termId: recentGradeTerm.id,
          },
          select: { studentId: true, classOfferingId: true, score: true },
        })
      : Promise.resolve([]),
  ]);

  const attendanceByStudent = new Map<string, {
    present: number;
    absent: number;
    late: number;
    excused: number;
  }>();
  for (const group of attendanceGroups) {
    const counts = attendanceByStudent.get(group.studentId) ?? {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };
    switch (group.status) {
      case AttendanceStatus.PRESENT: counts.present = group._count._all; break;
      case AttendanceStatus.ABSENT: counts.absent = group._count._all; break;
      case AttendanceStatus.LATE: counts.late = group._count._all; break;
      case AttendanceStatus.EXCUSED: counts.excused = group._count._all; break;
    }
    attendanceByStudent.set(group.studentId, counts);
  }

  const offeringsById = new Map(offerings.map((offering) => [offering.id, offering]));
  const gradesByStudent = new Map<string, typeof grades>();
  for (const grade of grades) {
    const studentGrades = gradesByStudent.get(grade.studentId) ?? [];
    studentGrades.push(grade);
    gradesByStudent.set(grade.studentId, studentGrades);
  }

  return {
    schoolYear: { id: schoolYear.id, name: schoolYear.name },
    section,
    currentTerm: currentTerm ? { id: currentTerm.id, name: currentTerm.name } : null,
    attendancePeriod,
    recentGradeTerm: recentGradeTerm ? { id: recentGradeTerm.id, name: recentGradeTerm.name } : null,
    students: students.map((student) => {
      const attendance = attendanceByStudent.get(student.id) ?? {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
      const attendanceTotal = attendance.present + attendance.absent + attendance.late + attendance.excused;
      const countableAttendance = attendance.present + attendance.absent + attendance.late;
      const attendanceRate = calculateAttendanceRate(attendance);
      const recentGrades = (gradesByStudent.get(student.id) ?? []).flatMap((grade) => {
        const offering = offeringsById.get(grade.classOfferingId);
        if (!offering) return [];
        return [{
          classOfferingId: offering.id,
          teacherAssigned: offering.teacherId === teacherId,
          subject: offering.subject,
          score: grade.score === null ? null : Number(grade.score),
        }];
      });

      return {
        ...student,
        status: EnrollmentStatus.ENROLLED,
        attendance: {
          ...attendance,
          total: attendanceTotal,
          rate: attendanceRate,
        },
        needsAttendanceFollowUp: countableAttendance >= 5 && attendanceRate !== null && attendanceRate < 90,
        recentGrades,
      };
    }),
  };
}

export async function getMyEnrollment(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!student) throw new AppError("Student profile not found", 404, "STUDENT_PROFILE_NOT_FOUND");
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  if (!schoolYear) return { enrollment: null, classOfferings: [] };

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: student.id,
      schoolYearId: schoolYear.id,
      status: EnrollmentStatus.ENROLLED,
    },
    include: {
      section: {
        include: {
          adviser: {
            select: { id: true, firstName: true, middleName: true, lastName: true },
          },
        },
      },
      schoolYear: { select: { id: true, name: true, isCurrent: true } },
    },
  });
  if (!enrollment) return { enrollment: null, classOfferings: [] };
  if (!enrollment.section) return { enrollment, classOfferings: [] };
  const classOfferings = await prisma.classOffering.findMany({
    where: { sectionId: enrollment.section.id, schoolYearId: schoolYear.id },
    orderBy: { subject: { name: "asc" } },
    include: {
      subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
      teacher: { select: { id: true, firstName: true, middleName: true, lastName: true } },
    },
  });
  return { enrollment, classOfferings };
}

async function getStudentProfileByUserId(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      id: true,
      studentNo: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  });
  if (!student) throw new AppError("Student profile not found", 404, "STUDENT_PROFILE_NOT_FOUND");
  return student;
}

async function getCurrentStudentSchoolYear(userId: string) {
  const student = await getStudentProfileByUserId(userId);
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true },
  });
  if (!schoolYear) return { student, schoolYear: null, classOfferingIds: [], subjectIds: [] };

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId: student.id,
      schoolYearId: schoolYear.id,
      status: EnrollmentStatus.ENROLLED,
    },
    select: { sectionId: true },
  });

  const sectionIds = enrollments.map(({ sectionId }) => sectionId).filter(Boolean) as string[];

  const offeringIds = sectionIds.length
    ? (await prisma.classOffering.findMany({
        where: { sectionId: { in: sectionIds }, schoolYearId: schoolYear.id },
        select: { id: true, subjectId: true },
      })).map(({ id, subjectId }) => ({ id, subjectId }))
    : [];

  return {
    student,
    schoolYear,
    classOfferingIds: offeringIds.map(({ id }) => id),
    subjectIds: [...new Set(offeringIds.map(({ subjectId }) => subjectId))],
  };
}

export async function getMyAssignments(userId: string) {
  const { student, schoolYear, classOfferingIds } = await getCurrentStudentSchoolYear(userId);
  if (!schoolYear) return { data: [] };

  const assignments = await prisma.assignment.findMany({
    where: {
      classOfferingId: { in: classOfferingIds },
    },
    orderBy: { dueAt: "asc" },
    include: {
      subject: { select: { id: true, code: true, name: true } },
      teacher: { select: { id: true, firstName: true, middleName: true, lastName: true } },
      classOffering: {
        select: {
          id: true,
          section: { select: { id: true, name: true, gradeLevel: true } },
        },
      },
      submissions: {
        where: { studentId: student.id },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
  });

  const now = new Date();
  return {
    data: assignments.map((assignment) => {
      const submission = assignment.submissions[0] ?? null;
      let status: string = AssignmentStatus.UPCOMING;
      if (submission) {
        status = submission.status;
      } else if (new Date(assignment.dueAt) < now) {
        status = AssignmentStatus.PENDING;
      }

      return {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        instructions: assignment.instructions,
        dueAt: assignment.dueAt,
        publishedAt: assignment.publishedAt,
        maxScore: assignment.maxScore ? Number(assignment.maxScore) : null,
        status,
        isSubmitted: Boolean(submission),
        submittedAt: submission?.submittedAt ?? null,
        subject: assignment.subject,
        teacher: assignment.teacher,
        section: assignment.classOffering.section,
        classOfferingId: assignment.classOfferingId,
      };
    }),
  };
}

export async function getMyAnnouncements(userId: string) {
  const { schoolYear, classOfferingIds, subjectIds } = await getCurrentStudentSchoolYear(userId);
  if (!schoolYear) return { data: [] };

  const announcements = await prisma.announcement.findMany({
    where: {
      OR: [
        { category: AnnouncementCategory.SCHOOL },
        { classOfferingId: { in: classOfferingIds } },
        { subjectId: { in: subjectIds } },
      ],
    },
    orderBy: { publishedAt: "desc" },
    include: {
      subject: { select: { id: true, code: true, name: true } },
      classOffering: {
        select: {
          id: true,
          section: { select: { id: true, name: true, gradeLevel: true } },
          subject: { select: { id: true, code: true, name: true } },
        },
      },
      createdBy: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  return {
    data: announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      category: announcement.category,
      isPinned: announcement.isPinned,
      publishedAt: announcement.publishedAt,
      expiresAt: announcement.expiresAt,
      attachments: announcement.attachments,
      subject: announcement.subject,
      classOffering: announcement.classOffering,
      createdBy: announcement.createdBy,
    })),
  };
}

export async function getMySchedule(userId: string) {
  const { student, schoolYear } = await getCurrentStudentSchoolYear(userId);
  if (!schoolYear) return { data: [] };

  const schedules = await prisma.classSchedule.findMany({
    where: { studentId: student.id, schoolYearId: schoolYear.id, isActive: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    include: {
      subject: { select: { id: true, code: true, name: true } },
      teacher: { select: { id: true, firstName: true, middleName: true, lastName: true } },
      section: { select: { id: true, name: true, gradeLevel: true } },
    },
  });

  return {
    data: schedules.map((item) => ({
      id: item.id,
      dayOfWeek: item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
      room: item.room,
      notes: item.notes,
      section: item.section,
      subject: item.subject,
      teacher: item.teacher,
    })),
  };
}

export async function getMyLearningMaterials(userId: string) {
  const { schoolYear, classOfferingIds, subjectIds } = await getCurrentStudentSchoolYear(userId);
  if (!schoolYear) return { data: [] };

  const learningMaterials = await prisma.learningMaterial.findMany({
    where: {
      OR: [
        { isRestricted: false },
        { classOfferingId: { in: classOfferingIds } },
        { subjectId: { in: subjectIds } },
      ],
    },
    orderBy: { uploadedAt: "desc" },
    include: {
      teacher: { select: { id: true, firstName: true, middleName: true, lastName: true } },
      subject: { select: { id: true, code: true, name: true } },
      classOffering: {
        select: {
          id: true,
          section: { select: { id: true, name: true, gradeLevel: true } },
          subject: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  return {
    data: learningMaterials.map((material) => ({
      id: material.id,
      title: material.title,
      description: material.description,
      fileName: material.fileName,
      fileUrl: material.fileUrl,
      fileType: material.fileType,
      uploadedAt: material.uploadedAt,
      isRestricted: material.isRestricted,
      teacher: material.teacher,
      subject: material.subject,
      classOffering: material.classOffering,
    })),
  };
}

export async function getMyDocumentRequests(userId: string) {
  const student = await getStudentProfileByUserId(userId);
  const documents = await prisma.documentRequest.findMany({
    where: { studentId: student.id },
    orderBy: { requestedAt: "desc" },
  });

  return { data: documents };
}

export async function createMyDocumentRequest(userId: string, rawInput: unknown) {
  const student = await getStudentProfileByUserId(userId);
  if (!rawInput || typeof rawInput !== "object") {
    throw new AppError("Document request payload is required", 400, "INVALID_DOCUMENT_REQUEST");
  }

  const input = rawInput as Record<string, unknown>;
  const documentType = typeof input.documentType === "string" ? input.documentType : "";
  const reason = typeof input.reason === "string" ? input.reason : "";
  const details = typeof input.details === "string" ? input.details : null;

  if (!Object.values(DocumentRequestType).includes(documentType as DocumentRequestType)) {
    throw new AppError("Invalid document type", 400, "INVALID_DOCUMENT_TYPE");
  }
  if (!reason.trim()) {
    throw new AppError("A reason is required", 400, "MISSING_REASON");
  }

  const document = await prisma.documentRequest.create({
    data: {
      studentId: student.id,
      documentType: documentType as DocumentRequestType,
      reason: reason.trim(),
      details: details?.trim() || null,
      status: DocumentRequestStatus.PENDING,
    },
  });

  return { data: document };
}

export async function getMyNotifications(userId: string) {
  const student = await getStudentProfileByUserId(userId);
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { userId },
        { studentId: student.id },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return { data: notifications };
}

export async function markMyNotificationRead(userId: string, notificationId: string) {
  const student = await getStudentProfileByUserId(userId);
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      OR: [{ userId }, { studentId: student.id }],
    },
  });

  if (!notification) {
    throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  return { data: updated };
}

export async function getMyAcademicHistory(userId: string) {
  const student = await getStudentProfileByUserId(userId);
  const grades = await prisma.grade.findMany({
    where: { studentId: student.id },
    include: {
      term: {
        select: { id: true, name: true, termNumber: true, schoolYear: { select: { id: true, name: true } } },
      },
      classOffering: {
        select: {
          id: true,
          subject: { select: { id: true, code: true, name: true } },
          section: { select: { id: true, name: true, gradeLevel: true } },
        },
      },
    },
    orderBy: [{ term: { termNumber: "asc" } }, { classOffering: { subject: { name: "asc" } } }],
  });

  const grouped = new Map<string, { term: { id:string; name:string; termNumber:number; schoolYear:{id:string; name:string} }; courses: Array<{ id:string; subject:{id:string; code:string; name:string}; score:number|null; section:{id:string; name:string; gradeLevel:number}; classOfferingId:string }> }>();
  for (const grade of grades) {
    const key = grade.term.id;
    const existing = grouped.get(key) ?? {
      term: grade.term,
      courses: [],
    };
    existing.courses.push({
      id: grade.id,
      subject: grade.classOffering.subject,
      score: grade.score ? Number(grade.score) : null,
      section: grade.classOffering.section,
      classOfferingId: grade.classOfferingId,
    });
    grouped.set(key, existing);
  }

  return {
    data: Array.from(grouped.values()).map(({ term, courses }) => {
      const validScores = courses.filter((course) => course.score !== null);
      return {
        term,
        average: validScores.length ? Number((validScores.reduce((sum, course) => sum + (course.score ?? 0), 0) / validScores.length).toFixed(2)) : null,
        courses,
      };
    }),
  };
}

export async function getMyProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      userProfile: {
        select: {
          middleName: true,
          phoneNumber: true,
          dateOfBirth: true,
          sex: true,
          address: true,
          photoMime: true,
          updatedAt: true,
        },
      },
      student: {
        select: {
          studentNo: true,
          firstName: true,
          middleName: true,
          lastName: true,
          birthDate: true,
          sex: true,
          address: true,
          enrollments: {
            where: {
              status: EnrollmentStatus.ENROLLED,
              schoolYear: { isCurrent: true },
            },
            take: 1,
            select: {
              section: { select: { name: true, gradeLevel: true } },
            },
          },
        },
      },
      teacher: {
        select: {
          employeeNo: true,
          firstName: true,
          middleName: true,
          lastName: true,
          department: true,
          contactNo: true,
        },
      },
    },
  });
  if (!user) throw new AppError("Not authenticated", 401);

  const fullName = (person: { firstName: string; middleName: string | null; lastName: string }) =>
    [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
  let person: unknown = null;
  if (user.student) {
    const section = user.student.enrollments[0]?.section;
    person = {
      type: "STUDENT",
      studentNo: user.student.studentNo,
      fullName: fullName(user.student),
      currentSection: section ? `Grade ${section.gradeLevel} - ${section.name}` : null,
    };
  } else if (user.teacher) {
    person = {
      type: "TEACHER",
      employeeNo: user.teacher.employeeNo,
      fullName: fullName(user.teacher),
      department: user.teacher.department,
      contactNo: user.teacher.contactNo,
    };
  }
  const personalProfile = user.userProfile
    ? {
        firstName: user.firstName,
        middleName: user.userProfile.middleName,
        lastName: user.lastName,
        phoneNumber: user.userProfile.phoneNumber,
        dateOfBirth: user.userProfile.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        sex: user.userProfile.sex,
        address: user.userProfile.address,
        photoUpdatedAt: user.userProfile.photoMime ? user.userProfile.updatedAt.toISOString() : null,
      }
    : {
        firstName: user.student?.firstName ?? user.teacher?.firstName ?? user.firstName,
        middleName: user.student?.middleName ?? user.teacher?.middleName ?? null,
        lastName: user.student?.lastName ?? user.teacher?.lastName ?? user.lastName,
        phoneNumber: user.teacher?.contactNo ?? null,
        dateOfBirth: user.student?.birthDate?.toISOString().slice(0, 10) ?? null,
        sex: user.student?.sex ?? null,
        address: user.student?.address ?? null,
        photoUpdatedAt: null,
      };
  return {
    user: {
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      passwordChangedAt: user.passwordChangedAt,
    },
    person,
    personalProfile,
    hasPersonalProfile: Boolean(user.userProfile || user.student || user.teacher),
  };
}

function detectProfilePhotoMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function getMyProfilePhoto(userId: string): Promise<{ data: Buffer; mime: string }> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { photoData: true, photoMime: true },
  });
  if (!profile?.photoData || !profile.photoMime) {
    throw new AppError("Profile photo not found", 404, "PROFILE_PHOTO_NOT_FOUND");
  }
  return { data: Buffer.from(profile.photoData), mime: profile.photoMime };
}

export async function updateMyProfile(
  userId: string,
  input: UpdateMyProfileInput,
  photo: Express.Multer.File | undefined,
  request: Request,
) {
  const photoMime = photo ? detectProfilePhotoMime(photo.buffer) : null;
  if (photo && (!photoMime || photoMime !== photo.mimetype)) {
    throw new AppError("The uploaded image content is invalid. Choose a JPG, PNG, or WebP image.", 400, "INVALID_PROFILE_PHOTO");
  }

  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        student: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
            birthDate: true,
            sex: true,
            address: true,
          },
        },
        teacher: {
          select: { firstName: true, middleName: true, lastName: true, contactNo: true },
        },
        userProfile: {
          select: {
            middleName: true,
            phoneNumber: true,
            dateOfBirth: true,
            sex: true,
            address: true,
            photoMime: true,
          },
        },
      },
    });
    if (!user) throw new AppError("Not authenticated", 401);

    const existing = user.userProfile;
    const before = {
      firstName: user.firstName,
      middleName: existing
        ? existing.middleName
        : user.student?.middleName ?? user.teacher?.middleName ?? null,
      lastName: user.lastName,
      phoneNumber: existing ? existing.phoneNumber : user.teacher?.contactNo ?? null,
      dateOfBirth: existing
        ? existing.dateOfBirth?.toISOString().slice(0, 10) ?? null
        : user.student?.birthDate?.toISOString().slice(0, 10) ?? null,
      sex: existing ? existing.sex : user.student?.sex ?? null,
      address: existing ? existing.address : user.student?.address ?? null,
      hasPhoto: Boolean(existing?.photoMime),
    };
    const dateOfBirth = input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null;

    await transaction.user.update({
      where: { id: userId },
      data: { firstName: input.firstName, lastName: input.lastName },
    });
    if (user.student) {
      await transaction.student.update({
        where: { userId },
        data: {
          firstName: input.firstName,
          middleName: input.middleName,
          lastName: input.lastName,
          birthDate: dateOfBirth,
          sex: input.sex ?? user.student.sex,
          address: input.address,
        },
      });
    }
    if (user.teacher) {
      await transaction.teacher.update({
        where: { userId },
        data: {
          firstName: input.firstName,
          middleName: input.middleName,
          lastName: input.lastName,
          contactNo: input.phoneNumber,
        },
      });
    }

    const profilePhotoUpdate = photo
      ? { photoData: Uint8Array.from(photo.buffer), photoMime }
      : input.removePhoto
        ? { photoData: null, photoMime: null }
        : {};
    const savedProfile = await transaction.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        middleName: input.middleName,
        phoneNumber: input.phoneNumber,
        dateOfBirth,
        sex: input.sex,
        address: input.address,
        photoData: photo ? Uint8Array.from(photo.buffer) : null,
        photoMime,
      },
      update: {
        middleName: input.middleName,
        phoneNumber: input.phoneNumber,
        dateOfBirth,
        sex: input.sex,
        address: input.address,
        ...profilePhotoUpdate,
      },
      select: { photoMime: true, updatedAt: true },
    });
    const after = {
      firstName: input.firstName,
      middleName: input.middleName,
      lastName: input.lastName,
      phoneNumber: input.phoneNumber,
      dateOfBirth: input.dateOfBirth,
      sex: input.sex,
      address: input.address,
      hasPhoto: Boolean(savedProfile.photoMime),
    };
    await audit(transaction, request, {
      action: existing ? "PROFILE_UPDATED" : "PROFILE_CREATED",
      entityType: "UserProfile",
      entityId: userId,
      before,
      after,
    });

    return {
      ...after,
      photoUpdatedAt: savedProfile.photoMime ? savedProfile.updatedAt.toISOString() : null,
    };
  }, { timeout: 30_000 });
}
