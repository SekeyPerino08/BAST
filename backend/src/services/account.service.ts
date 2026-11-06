import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";

type PersonAccountInput =
  | { kind: "student"; personId: string; email: string }
  | { kind: "teacher"; personId: string; email: string };

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function createPersonAccount(input: PersonAccountInput) {
  const temporaryPassword = input.kind === "student" ? "student1234" : "faculty1234";
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const person =
        input.kind === "student"
          ? await transaction.student.findUnique({
              where: { id: input.personId },
              select: {
                id: true,
                userId: true,
                firstName: true,
                lastName: true,
                studentNo: true,
                status: true,
              },
            })
          : await transaction.teacher.findUnique({
              where: { id: input.personId },
              select: {
                id: true,
                userId: true,
                firstName: true,
                lastName: true,
                employeeNo: true,
                isActive: true,
              },
            });

      if (!person) {
        throw new AppError(input.kind === "student" ? "Student not found" : "Teacher not found", 404);
      }
      if (person.userId) {
        throw new AppError(
          `This ${input.kind} already has an account`,
          409,
          "ACCOUNT_EXISTS",
        );
      }

      const existingUser = await transaction.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existingUser) {
        throw new AppError("This email address is already in use", 409, "EMAIL_EXISTS");
      }

      const role = input.kind === "student" ? Role.STUDENT : Role.TEACHER;
      const isActive =
        input.kind === "student"
          ? "status" in person && person.status === "ACTIVE"
          : "isActive" in person && person.isActive;
      const relation =
        input.kind === "student"
          ? { student: { connect: { id: person.id } } }
          : { teacher: { connect: { id: person.id } } };

      return transaction.user.create({
        data: {
          email: input.email,
          loginId: input.kind === "student" && "studentNo" in person
            ? person.studentNo.toUpperCase()
            : input.kind === "teacher" && "employeeNo" in person
              ? person.employeeNo.toUpperCase()
              : null,
          passwordHash,
          role,
          isActive,
          mustChangePassword: true,
          firstName: person.firstName,
          lastName: person.lastName,
          ...relation,
        },
        select: { id: true, email: true, loginId: true, role: true, isActive: true },
      });
    });

    return { user, temporaryPassword };
  } catch (error) {
    if (isKnownError(error, "P2025")) {
      throw new AppError(input.kind === "student" ? "Student not found" : "Teacher not found", 404);
    }
    if (isKnownError(error, "P2002")) {
      const target = error.meta?.target;
      if (
        (Array.isArray(target) && target.includes("loginId")) ||
        (typeof target === "string" && target.includes("loginId"))
      ) {
        throw new AppError("This login ID is already in use", 409, "LOGIN_ID_EXISTS");
      }
      if (
        (Array.isArray(target) && target.includes("email")) ||
        (typeof target === "string" && target.includes("email"))
      ) {
        throw new AppError("This email address is already in use", 409, "EMAIL_EXISTS");
      }
      throw new AppError(`This ${input.kind} already has an account`, 409, "ACCOUNT_EXISTS");
    }
    throw error;
  }
}

export async function setLinkedUserActive(
  transaction: Prisma.TransactionClient,
  userId: string,
  isActive: boolean,
): Promise<void> {
  await transaction.user.update({ where: { id: userId }, data: { isActive } });
}
