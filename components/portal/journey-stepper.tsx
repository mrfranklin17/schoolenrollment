import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { JOURNEY_STEPS, journeyIndex } from "@/lib/stage-style";

/** SchoolMint-style horizontal progress stepper for an application. */
export function JourneyStepper({ category }: { category: string | null | undefined }) {
  const current = journeyIndex(category);

  return (
    <ol className="flex items-center gap-0">
      {JOURNEY_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-card text-primary",
                  !done && !active && "border-border bg-card text-muted-foreground"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[10px] font-semibold",
                  active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {i < JOURNEY_STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 mb-4 h-0.5 flex-1 rounded",
                  i < current ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
