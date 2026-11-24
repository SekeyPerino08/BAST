export interface SectionSizeItem {
  sectionId: string;
  label: string;
  name: string;
  gradeLevel: number;
  strand: string | null;
  students: number;
  capacity: number | null;
  adviserName: string | null;
  classOfferingCount: number;
}

export type SectionSizesSort = "grade" | "size";

export function shortenSectionLabel(gradeLevel: number, name: string): string {
  const sectionName = name.replace(new RegExp(`^Grade\\s+${gradeLevel}\\s*[-–·]\\s*`, "i"), "");
  const gradeSuffix = new RegExp(`^(.*?)\\s+${gradeLevel}-([A-Z0-9]+)$`, "i").exec(sectionName);
  if (gradeSuffix) return `${gradeLevel} · ${gradeSuffix[1]} · ${gradeSuffix[2]}`;
  return `${gradeLevel} · ${sectionName}`;
}

export function sortSectionSizes(
  sections: readonly SectionSizeItem[],
  sortBy: SectionSizesSort = "grade",
): SectionSizeItem[] {
  return [...sections].sort((a, b) => {
    if (sortBy === "size" && a.students !== b.students) return b.students - a.students;
    return a.gradeLevel - b.gradeLevel
      || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function filterSectionSizes(
  sections: readonly SectionSizeItem[],
  showAll: boolean,
): SectionSizeItem[] {
  return showAll ? [...sections] : sections.filter((section) => section.students > 0);
}

export function sectionSizeAxisTicks(sections: readonly SectionSizeItem[]): number[] {
  const maximum = Math.max(
    0,
    ...sections.flatMap((section) => [section.students, section.capacity ?? 0]),
  );
  const step = Math.max(1, Math.ceil(maximum / 4));
  const axisMaximum = Math.max(step, Math.ceil(maximum / step) * step);
  return Array.from({ length: Math.floor(axisMaximum / step) + 1 }, (_, index) => index * step);
}

export function sectionCapacityStatus(section: SectionSizeItem): "low" | "normal" | "full" | null {
  if (section.capacity === null) return null;
  const occupancy = section.students / section.capacity;
  if (occupancy < 0.5) return "low";
  if (occupancy < 1) return "normal";
  return "full";
}
