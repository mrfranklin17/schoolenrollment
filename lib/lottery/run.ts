import { createHash } from "crypto";

/**
 * Deterministic weighted lottery.
 *
 * Each entry gets a draw value u ∈ (0,1) derived from sha256(seed:entryId) —
 * so a stored seed makes every run exactly reproducible for audits. Weighted
 * priority uses exponential sampling: score = -ln(u) / weight. Lower scores
 * win, and an entry with weight w is exactly w times as likely to outrank an
 * entry with weight 1 (Efraimidis–Spirakis weighted sampling).
 */

export interface LotteryEntryInput {
  applicationId: string;
  /** preference flags that applied, e.g. { sibling: true } */
  preferences: Record<string, boolean>;
}

export interface LotteryEntryResult {
  applicationId: string;
  preferences: Record<string, boolean>;
  weight: number;
  ticket: number;
  rank: number;
}

export function drawValue(seed: string, applicationId: string): number {
  const digest = createHash("sha256").update(`${seed}:${applicationId}`).digest();
  // 6 bytes → 48 bits of precision, uniform in (0, 1).
  const n = digest.readUIntBE(0, 6);
  return (n + 0.5) / 2 ** 48;
}

export function computeWeight(
  preferences: Record<string, boolean>,
  weights: Record<string, number>
): number {
  let weight = 1;
  for (const [key, applied] of Object.entries(preferences)) {
    if (applied && typeof weights[key] === "number" && weights[key] > 0) {
      weight *= weights[key];
    }
  }
  return weight;
}

export function runLotteryDraw(
  seed: string,
  entries: LotteryEntryInput[],
  weights: Record<string, number>
): LotteryEntryResult[] {
  const scored = entries.map((entry) => {
    const weight = computeWeight(entry.preferences, weights);
    const u = drawValue(seed, entry.applicationId);
    return {
      applicationId: entry.applicationId,
      preferences: entry.preferences,
      weight,
      ticket: -Math.log(u) / weight,
    };
  });

  scored.sort(
    (a, b) => a.ticket - b.ticket || a.applicationId.localeCompare(b.applicationId)
  );

  return scored.map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/**
 * Preference flags are read from application responses: a form field keyed
 * with the preference name (e.g. `sibling`) counts when answered truthy.
 */
export function preferencesFromResponses(
  responses: Record<string, unknown>,
  weightKeys: string[]
): Record<string, boolean> {
  const preferences: Record<string, boolean> = {};
  for (const key of weightKeys) {
    const value = responses[key];
    preferences[key] =
      value === true ||
      value === "yes" ||
      value === "true" ||
      (Array.isArray(value) && value.length > 0);
  }
  return preferences;
}
