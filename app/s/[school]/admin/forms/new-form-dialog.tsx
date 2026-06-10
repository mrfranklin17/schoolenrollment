"use client";

import { useActionState } from "react";

import { createFormTemplate, type FormActionState } from "@/lib/forms/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function NewFormDialog({
  school,
  periods,
}: {
  school: string;
  periods: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(
    createFormTemplate,
    undefined
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>New form</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create an application form</DialogTitle>
          <DialogDescription>
            You&apos;ll add fields in the next step. Leave grades empty to use this form for all
            grades.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="school" value={school} />
          <div className="space-y-2">
            <Label htmlFor="name">Form name</Label>
            <Input id="name" name="name" placeholder="2026–27 New Student Application" required />
          </div>
          <div className="space-y-2">
            <Label>Enrollment period</Label>
            <Select name="periodId">
              <SelectTrigger>
                <SelectValue placeholder="Select a period (optional)" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gradeLevels">Grade levels (comma-separated, optional)</Label>
            <Input id="gradeLevels" name="gradeLevels" placeholder="K, 1, 2" />
          </div>
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create form"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
