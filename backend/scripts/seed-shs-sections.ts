import "dotenv/config";
import { PrismaClient, SeniorHighStrand } from "@prisma/client";

const prisma = new PrismaClient();
const strands = [
  { value: SeniorHighStrand.GAS, label: "GAS" },
  { value: SeniorHighStrand.ABM, label: "ABM" },
  { value: SeniorHighStrand.STEM, label: "STEM" },
  { value: SeniorHighStrand.HUMSS, label: "HUMSS" },
  { value: SeniorHighStrand.TVL_ICT, label: "TVL-ICT" },
] as const;

async function seedSeniorHighSections() {
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true },
  });
  if (!schoolYear) throw new Error("Cannot seed Senior High sections: no current school year is configured.");

  let createdOrUpdated = 0;
  for (const gradeLevel of [11, 12]) {
    for (const strand of strands) {
      const name = `${strand.label} ${gradeLevel}-A`;
      await prisma.section.upsert({
        where: {
          schoolYearId_gradeLevel_name: {
            schoolYearId: schoolYear.id,
            gradeLevel,
            name,
          },
        },
        update: { strand: strand.value },
        create: {
          schoolYearId: schoolYear.id,
          gradeLevel,
          name,
          strand: strand.value,
        },
      });
      createdOrUpdated += 1;
    }
  }
  console.log(`Ensured ${createdOrUpdated} Grade 11/12 strand sections for ${schoolYear.name}.`);
}

seedSeniorHighSections()
  .catch((error: unknown) => {
    console.error("Could not seed Senior High sections:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
