import { requireStaff } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_KEYS } from "@/lib/comms/templates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkEmailForm, TemplateEditor } from "./comms-forms";

export const metadata = { title: "Communications" };

export default async function CommunicationsPage({
  params,
}: {
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  const { tenant } = await requireStaff(school);
  const supabase = await createClient();

  const [{ data: templates }, { data: stages }, { data: log }] = await Promise.all([
    supabase
      .from("email_templates")
      .select("key, name, subject, body")
      .eq("tenant_id", tenant.id)
      .overrideTypes<{ key: string; name: string; subject: string; body: string }[]>(),
    supabase
      .from("pipeline_stages")
      .select("id, label")
      .eq("tenant_id", tenant.id)
      .order("position")
      .overrideTypes<{ id: string; label: string }[]>(),
    supabase
      .from("email_log")
      .select("id, recipient_email, subject, status, template_key, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .overrideTypes<
        { id: string; recipient_email: string; subject: string; status: string; template_key: string | null; created_at: string }[]
      >(),
  ]);

  const templateByKey = new Map((templates ?? []).map((t) => [t.key, t]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Communications</h1>
        <p className="text-muted-foreground">
          Customize the emails families receive, send bulk messages, and review the send log.
        </p>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="bulk">Bulk email</TabsTrigger>
          <TabsTrigger value="log">Send log</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {TEMPLATE_KEYS.map((slot) => (
            <TemplateEditor
              key={slot.key}
              school={school}
              templateKey={slot.key}
              name={slot.name}
              existing={templateByKey.get(slot.key) ?? null}
            />
          ))}
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Send a bulk email</CardTitle>
              <CardDescription>
                Emails every family with an application in the selected stage. Merge fields like{" "}
                <code className="font-mono text-xs">{"{{guardian_name}}"}</code> are personalized
                per recipient.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BulkEmailForm school={school} stages={stages ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(log ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No emails sent yet.
                    </TableCell>
                  </TableRow>
                )}
                {(log ?? []).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.recipient_email}</TableCell>
                    <TableCell className="max-w-72 truncate">{entry.subject}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.template_key}</TableCell>
                    <TableCell>
                      <Badge variant={entry.status === "sent" ? "success" : "destructive"}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
