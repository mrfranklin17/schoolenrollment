import type { StageCategory } from "@/lib/types";

/**
 * Shared color treatment for pipeline-stage categories — chips, dots, and
 * board column accents stay consistent across admin and parent views.
 */
export const STAGE_STYLE: Record<
  StageCategory,
  { chip: string; dot: string }
> = {
  in_progress: { chip: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  submitted: { chip: "bg-sky-100 text-sky-800", dot: "bg-sky-500" },
  in_review: { chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  offered: { chip: "bg-violet-100 text-violet-800", dot: "bg-violet-500" },
  accepted: { chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  enrolled: { chip: "bg-teal-100 text-teal-800", dot: "bg-teal-500" },
  waitlisted: { chip: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  declined: { chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  withdrawn: { chip: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
};

export function stageChipClass(category: string | null | undefined): string {
  return STAGE_STYLE[(category ?? "in_progress") as StageCategory]?.chip ?? STAGE_STYLE.in_progress.chip;
}

export function stageDotClass(category: string | null | undefined): string {
  return STAGE_STYLE[(category ?? "in_progress") as StageCategory]?.dot ?? STAGE_STYLE.in_progress.dot;
}

/** Coarse parent-facing journey used by the portal progress stepper. */
export const JOURNEY_STEPS = ["Started", "Submitted", "In Review", "Decision"] as const;

export function journeyIndex(category: string | null | undefined): number {
  switch (category) {
    case "submitted":
      return 1;
    case "in_review":
      return 2;
    case "offered":
    case "accepted":
    case "enrolled":
    case "waitlisted":
    case "declined":
    case "withdrawn":
      return 3;
    default:
      return 0;
  }
}
