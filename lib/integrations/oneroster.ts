import "server-only";

import JSZip from "jszip";

import { toCsv } from "@/lib/integrations/csv";
import type { ExportApplicationRow } from "@/lib/integrations/export-data";

/**
 * OneRoster 1.2 CSV rostering bundle (bulk mode) built from accepted/enrolled
 * applications — importable by PowerSchool, Infinite Campus, Skyward, and
 * other OneRoster-compliant SIS platforms.
 */
export async function buildOneRosterZip(
  tenant: { id: string; name: string; slug: string },
  rows: ExportApplicationRow[]
): Promise<Uint8Array> {
  const enrolled = rows.filter((r) => ["accepted", "enrolled"].includes(r.stage.category));
  const now = new Date().toISOString();
  const orgSourcedId = `org-${tenant.id}`;

  const periods = new Map(enrolled.map((r) => [r.period.id, r.period]));
  const grades = Array.from(new Set(enrolled.map((r) => r.grade_applying)));

  const manifest = toCsv([
    ["propertyName", "value"],
    ["manifest.version", "1.0"],
    ["oneroster.version", "1.2"],
    ["file.academicSessions", "bulk"],
    ["file.categories", "absent"],
    ["file.classes", "bulk"],
    ["file.classResources", "absent"],
    ["file.courses", "bulk"],
    ["file.courseResources", "absent"],
    ["file.demographics", "bulk"],
    ["file.enrollments", "bulk"],
    ["file.lineItemLearningObjectiveIds", "absent"],
    ["file.lineItems", "absent"],
    ["file.lineItemScoreScales", "absent"],
    ["file.orgs", "bulk"],
    ["file.resources", "absent"],
    ["file.resultLearningObjectiveIds", "absent"],
    ["file.results", "absent"],
    ["file.resultScoreScales", "absent"],
    ["file.roles", "absent"],
    ["file.scoreScales", "absent"],
    ["file.userProfiles", "absent"],
    ["file.userResources", "absent"],
    ["file.users", "bulk"],
  ]);

  const orgs = toCsv([
    ["sourcedId", "status", "dateLastModified", "name", "type", "identifier", "parentSourcedId"],
    [orgSourcedId, "active", now, tenant.name, "school", tenant.slug, ""],
  ]);

  const academicSessions = toCsv([
    ["sourcedId", "status", "dateLastModified", "title", "type", "startDate", "endDate", "parentSourcedId", "schoolYear"],
    ...Array.from(periods.values()).map((p) => {
      const startYear = p.academic_year.match(/\d{4}/)?.[0] ?? `${new Date().getFullYear()}`;
      const endYear = `${Number(startYear) + 1}`;
      return [
        `as-${p.id}`,
        "active",
        now,
        p.name,
        "schoolYear",
        `${startYear}-08-01`,
        `${endYear}-06-30`,
        "",
        endYear,
      ];
    }),
  ]);

  const courses = toCsv([
    ["sourcedId", "status", "dateLastModified", "schoolYearSourcedId", "title", "courseCode", "grades", "orgSourcedId", "subjects", "subjectCodes"],
    ...grades.map((g) => [`course-${g}`, "active", now, "", `Grade ${g}`, `GR-${g}`, g, orgSourcedId, "", ""]),
  ]);

  const classes = toCsv([
    ["sourcedId", "status", "dateLastModified", "title", "grades", "courseSourcedId", "classCode", "classType", "location", "schoolSourcedId", "termSourcedIds", "subjects", "subjectCodes", "periods"],
    ...grades.map((g) => [
      `class-${g}`,
      "active",
      now,
      `Grade ${g} Roster`,
      g,
      `course-${g}`,
      `GR-${g}`,
      "homeroom",
      "",
      orgSourcedId,
      Array.from(periods.keys()).map((id) => `as-${id}`).join(","),
      "",
      "",
      "",
    ]),
  ]);

  const userRows: (string | null)[][] = [];
  const seenGuardians = new Set<string>();
  for (const r of enrolled) {
    const guardianIds = r.guardians.map((g) => `user-g-${g.email}`);
    userRows.push([
      `user-s-${r.student.id}`,
      "active",
      now,
      "true",
      r.student.sis_id ?? "",
      r.student.first_name,
      r.student.last_name,
      "",
      "student",
      "",
      "",
      orgSourcedId,
      r.grade_applying,
      "",
      guardianIds.join(","),
    ]);
    for (const g of r.guardians) {
      const id = `user-g-${g.email}`;
      if (seenGuardians.has(id)) continue;
      seenGuardians.add(id);
      const [first, ...rest] = (g.full_name ?? g.email).split(" ");
      userRows.push([
        id,
        "active",
        now,
        "true",
        "",
        first,
        rest.join(" ") || "-",
        "",
        "guardian",
        "",
        g.email,
        orgSourcedId,
        "",
        "",
        "",
      ]);
    }
  }
  const users = toCsv([
    ["sourcedId", "status", "dateLastModified", "enabledUser", "identifier", "givenName", "familyName", "middleName", "role", "username", "email", "orgSourcedIds", "grades", "password", "agentSourcedIds"],
    ...userRows,
  ]);

  const enrollments = toCsv([
    ["sourcedId", "status", "dateLastModified", "classSourcedId", "schoolSourcedId", "userSourcedId", "role", "primary", "beginDate", "endDate"],
    ...enrolled.map((r) => [
      `enr-${r.id}`,
      "active",
      now,
      `class-${r.grade_applying}`,
      orgSourcedId,
      `user-s-${r.student.id}`,
      "student",
      "true",
      "",
      "",
    ]),
  ]);

  const demographics = toCsv([
    ["sourcedId", "status", "dateLastModified", "birthDate", "sex", "americanIndianOrAlaskaNative", "asian", "blackOrAfricanAmerican", "nativeHawaiianOrOtherPacificIslander", "white", "demographicRaceTwoOrMoreRaces", "hispanicOrLatinoEthnicity", "countryOfBirthCode", "stateOfBirthAbbreviation", "cityOfBirth", "publicSchoolResidenceStatus"],
    ...enrolled.map((r) => [
      `user-s-${r.student.id}`,
      "active",
      now,
      r.student.date_of_birth ?? "",
      "", "", "", "", "", "", "", "", "", "", "", "",
    ]),
  ]);

  const zip = new JSZip();
  zip.file("manifest.csv", manifest);
  zip.file("orgs.csv", orgs);
  zip.file("academicSessions.csv", academicSessions);
  zip.file("courses.csv", courses);
  zip.file("classes.csv", classes);
  zip.file("users.csv", users);
  zip.file("enrollments.csv", enrollments);
  zip.file("demographics.csv", demographics);

  return zip.generateAsync({ type: "uint8array" });
}
