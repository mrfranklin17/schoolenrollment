"use client";

import { useActionState } from "react";

import {
  createDocumentRequirement,
  createPeriod,
  setGradeCapacity,
  updateBranding,
  type ActionState,
} from "@/lib/admin/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADES } from "@/lib/types";

export function BrandingForm({
  school,
  initial,
}: {
  school: string;
  initial: { name: string; logoUrl: string; primaryColor: string };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateBranding,
    undefined
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="school" value={school} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="brand-name">School name</Label>
          <Input id="brand-name" name="name" defaultValue={initial.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand-color">Primary color</Label>
          <Input
            id="brand-color"
            name="primaryColor"
            defaultValue={initial.primaryColor}
            placeholder="#1d4ed8"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="brand-logo">Logo URL</Label>
        <Input
          id="brand-logo"
          name="logoUrl"
          defaultValue={initial.logoUrl}
          placeholder="https://your-school.org/logo.png"
        />
      </div>
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.ok && (
        <Alert>
          <AlertDescription>Branding saved.</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save branding"}
      </Button>
    </form>
  );
}

export function NewPeriodForm({ school }: { school: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createPeriod,
    undefined
  );

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-dashed p-4">
      <p className="font-medium">Add an enrollment period</p>
      <input type="hidden" name="school" value={school} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="academicYear">Academic year</Label>
          <Input id="academicYear" name="academicYear" placeholder="2026-2027" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="period-name">Name</Label>
          <Input id="period-name" name="name" placeholder="Fall 2026 Open Enrollment" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="opensAt">Opens</Label>
          <Input id="opensAt" name="opensAt" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="closesAt">Closes</Label>
          <Input id="closesAt" name="closesAt" type="date" />
        </div>
      </div>
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add period"}
      </Button>
    </form>
  );
}

export function CapacityForm({ school, periodId }: { school: string; periodId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setGradeCapacity,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="school" value={school} />
      <input type="hidden" name="periodId" value={periodId} />
      <div className="space-y-1.5">
        <Label>Grade</Label>
        <Select name="grade" required>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            {GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`seats-${periodId}`}>Seats</Label>
        <Input
          id={`seats-${periodId}`}
          name="seats"
          type="number"
          min={0}
          className="w-24"
          required
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Set capacity"}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function NewRequirementForm({ school }: { school: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createDocumentRequirement,
    undefined
  );

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-dashed p-4">
      <p className="font-medium">Add a checklist item</p>
      <input type="hidden" name="school" value={school} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="req-name">Document name</Label>
          <Input id="req-name" name="name" placeholder="Birth certificate" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-desc">Instructions (optional)</Label>
          <Input id="req-desc" name="description" placeholder="A photo or scan is fine" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="required" defaultChecked />
        Required for enrollment
      </label>
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add item"}
      </Button>
    </form>
  );
}
