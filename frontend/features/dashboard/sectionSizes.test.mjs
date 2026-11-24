import assert from "node:assert/strict";
import test from "node:test";
import {
  filterSectionSizes,
  shortenSectionLabel,
  sortSectionSizes,
} from "./sectionSizes.ts";

const sections = [
  { sectionId: "12-gas", name: "GAS 12-A", gradeLevel: 12, students: 1 },
  { sectionId: "7-rizal", name: "Rizal", gradeLevel: 7, students: 6 },
  { sectionId: "11-abm", name: "ABM 11-A", gradeLevel: 11, students: 0 },
  { sectionId: "7-bonifacio", name: "Bonifacio", gradeLevel: 7, students: 3 },
].map((section) => ({
  label: `Grade ${section.gradeLevel} - ${section.name}`,
  strand: null,
  capacity: null,
  adviserName: null,
  classOfferingCount: 0,
  ...section,
}));

test("shortens common section labels without dropping section identifiers", () => {
  assert.equal(shortenSectionLabel(7, "Rizal"), "7 · Rizal");
  assert.equal(shortenSectionLabel(11, "ABM 11-A"), "11 · ABM · A");
  assert.equal(shortenSectionLabel(12, "TVL-ICT 12-A"), "12 · TVL-ICT · A");
  assert.equal(shortenSectionLabel(7, "Grade 7 - Rizal"), "7 · Rizal");
});

test("sorts by grade and section name by default and by enrollment on request", () => {
  assert.deepEqual(sortSectionSizes(sections).map(({ sectionId }) => sectionId), [
    "7-bonifacio", "7-rizal", "11-abm", "12-gas",
  ]);
  assert.deepEqual(sortSectionSizes(sections, "size").map(({ sectionId }) => sectionId), [
    "7-rizal", "7-bonifacio", "12-gas", "11-abm",
  ]);
});

test("hides empty sections by default and includes them when requested", () => {
  assert.deepEqual(filterSectionSizes(sections, false).map(({ sectionId }) => sectionId), [
    "12-gas", "7-rizal", "7-bonifacio",
  ]);
  assert.equal(filterSectionSizes(sections, true).length, sections.length);
});
