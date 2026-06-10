"use client";

import { useActionState } from "react";

import { addStudent, type PortalActionState } from "@/lib/portal/actions";
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
import { GRADES } from "@/lib/types";

export function AddStudentDialog({ school }: { school: string }) {
  const [state, formAction, pending] = useActionState<PortalActionState, FormData>(
    addStudent,
    undefined
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Add student</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a student</DialogTitle>
          <DialogDescription>
            We only collect what the school needs to process an application.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="school" value={school} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" />
          </div>
          <div className="space-y-2">
            <Label>Current grade (if any)</Label>
            <Select name="currentGrade">
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
            {pending ? "Adding…" : "Add student"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
