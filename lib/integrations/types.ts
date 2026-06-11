/**
 * SIS integration provider interface.
 *
 * The MVP ships file-based providers (OneRoster 1.2 CSV bundle, flat CSV).
 * Direct API connectors (PowerSchool, Infinite Campus OneRoster REST,
 * Clever/ClassLink) implement this same interface later — no refactoring of
 * calling code required.
 */

export interface RosterStudent {
  sisId: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  grade: string | null;
  guardianEmail: string | null;
  guardianName: string | null;
}

export interface ExportContext {
  tenantId: string;
  periodId?: string;
}

export interface SISProvider {
  key: string;
  name: string;
  /** 'file' providers produce downloads; 'api' providers talk to the SIS. */
  mode: "file" | "api";
  /** Pull a returning-student roster (re-enrollment). */
  importRoster?(context: ExportContext): Promise<RosterStudent[]>;
  /** Push/produce enrollment data for the SIS. */
  exportEnrollments?(context: ExportContext): Promise<Blob | void>;
}

/** Registry — API connectors get added here when partner access lands. */
export const PROVIDERS: SISProvider[] = [
  { key: "oneroster-csv", name: "OneRoster 1.2 CSV bundle", mode: "file" },
  { key: "flat-csv", name: "Flat CSV (custom mapping)", mode: "file" },
];
