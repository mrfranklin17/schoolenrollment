"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { moveApplications } from "@/lib/admin/pipeline-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface PipelineApplication {
  id: string;
  studentName: string;
  grade: string;
  period: string;
  stageId: string;
  submittedAt: string | null;
  paymentStatus: string;
  feeWaived: boolean;
  docsVerified: number;
  docsTotal: number;
}

interface Stage {
  id: string;
  key: string;
  label: string;
  category: string;
  position: number;
}

export function PipelineView({
  school,
  stages,
  applications,
  capacity,
}: {
  school: string;
  stages: Stage[];
  applications: PipelineApplication[];
  capacity: { grade: string; seats: number; filled: number }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<string>("");
  const [notify, setNotify] = useState(true);
  const [pending, startTransition] = useTransition();
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  const grades = useMemo(
    () => Array.from(new Set(applications.map((a) => a.grade))).sort(),
    [applications]
  );
  const filtered =
    gradeFilter === "all" ? applications : applications.filter((a) => a.grade === gradeFilter);

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const move = (ids: string[], stageId: string) => {
    startTransition(async () => {
      await moveApplications({ school, applicationIds: ids, stageId, notify });
      setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="text-muted-foreground">{applications.length} applications</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All grades</SelectItem>
              {grades.map((g) => (
                <SelectItem key={g} value={g}>
                  Grade {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {capacity.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {capacity.map((c) => (
            <Badge
              key={c.grade}
              variant={c.filled >= c.seats ? "destructive" : "secondary"}
              title="accepted + enrolled vs seats"
            >
              Grade {c.grade}: {c.filled}/{c.seats} seats
            </Badge>
          ))}
        </div>
      )}

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-3">
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Select value={bulkStage} onValueChange={setBulkStage}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Move to stage…" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
                Email families
              </label>
              <Button
                size="sm"
                disabled={!bulkStage || pending}
                onClick={() => move(Array.from(selected), bulkStage)}
              >
                {pending ? "Moving…" : "Apply"}
              </Button>
            </div>
          )}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No applications yet.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/s/${school}/admin/applications/${a.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {a.studentName}
                      </Link>
                    </TableCell>
                    <TableCell>{a.grade}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{stageById.get(a.stageId)?.label ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.docsTotal > 0 ? `${a.docsVerified}/${a.docsTotal} verified` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.feeWaived ? (
                        <Badge variant="outline">waived</Badge>
                      ) : (
                        <span className="text-muted-foreground">{a.paymentStatus.replace("_", " ")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "draft"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="board">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const cards = filtered.filter((a) => a.stageId === stage.id);
              return (
                <Card key={stage.id} className="w-72 shrink-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      {stage.label}
                      <Badge variant="secondary">{cards.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {cards.map((a) => (
                      <div key={a.id} className="rounded-md border p-3">
                        <Link
                          href={`/s/${school}/admin/applications/${a.id}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {a.studentName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Grade {a.grade}
                          {a.docsTotal > 0 && ` · docs ${a.docsVerified}/${a.docsTotal}`}
                        </p>
                        <Select value="" onValueChange={(stageId) => move([a.id], stageId)}>
                          <SelectTrigger className="mt-2 h-7 text-xs">
                            <SelectValue placeholder="Move to…" />
                          </SelectTrigger>
                          <SelectContent>
                            {stages
                              .filter((s) => s.id !== stage.id)
                              .map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    {cards.length === 0 && (
                      <p className="py-4 text-center text-xs text-muted-foreground">Empty</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
