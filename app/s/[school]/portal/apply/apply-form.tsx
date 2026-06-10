"use client";

import Link from "next/link";
import { useActionState } from "react";

import { startApplication, type PortalActionState } from "@/lib/portal/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADES } from "@/lib/types";

export function ApplyForm({
  school,
  students,
  periods,
}: {
  school: string;
  students: { id: string; first_name: string; last_name: string }[];
  periods: { id: string; name: string; academic_year: string }[];
}) {
  const [state, formAction, pending] = useActionState<PortalActionState, FormData>(
    startApplication,
    undefined
  );

  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        First,{" "}
        <Link href={`/s/${school}/portal`} className="underline">
          add a student to your family
        </Link>
        , then come back here.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="school" value={school} />
      <div className="space-y-2">
        <Label>Student</Label>
        <Select name="studentId" required>
          <SelectTrigger>
            <SelectValue placeholder="Select student" />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>School year</Label>
        <Select name="periodId" required defaultValue={periods.length === 1 ? periods[0].id : undefined}>
          <SelectTrigger>
            <SelectValue placeholder="Select school year" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({p.academic_year})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Grade applying for</Label>
        <Select name="grade" required>
          <SelectTrigger>
            <SelectValue placeholder="Select grade" />
          </SelectTrigger>
          <SelectContent>
            {GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {g === "PK" ? "Pre-K" : g === "K" ? "Kindergarten" : `Grade ${g}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Starting…" : "Begin application"}
      </Button>
    </form>
  );
}
