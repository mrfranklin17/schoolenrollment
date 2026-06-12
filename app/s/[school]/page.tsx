import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import { CalendarCheck, FileText, GraduationCap, Upload } from "lucide-react";

import { getTenantBySlug, getUser } from "@/lib/tenant";
import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: FileText, title: "Apply online", text: "Fill out the application from any device — save a draft and finish later." },
  { icon: Upload, title: "Upload documents", text: "Snap photos of required documents right from your phone." },
  { icon: CalendarCheck, title: "Track your status", text: "Follow every step and get email updates on decisions and offers." },
];

export default async function SchoolLandingPage({
  params,
}: {
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  const [tenant, user] = await Promise.all([getTenantBySlug(school), getUser()]);
  const portalHref = `/s/${school}/portal`;

  return (
    <main className="flex-1">
      <section className="bg-[color:var(--brand)] text-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={`${tenant.name} logo`}
              className="mx-auto mb-6 h-20 w-20 rounded-2xl bg-white object-contain p-2 shadow-lg"
            />
          ) : (
            <span className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 shadow-lg">
              <GraduationCap className="h-10 w-10" />
            </span>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{tenant.name}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">
            Welcome! Apply for enrollment, upload documents, and track your application — all
            from your phone.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              asChild
              className="bg-white font-bold text-[color:var(--brand)] hover:bg-white/90"
            >
              <Link href={user ? portalHref : `/signup?next=${encodeURIComponent(portalHref)}`}>
                {user ? "Go to family portal" : "Start an application"}
              </Link>
            </Button>
            {!user && (
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white/60 bg-transparent font-bold text-white hover:bg-white/10 hover:text-white"
              >
                <Link href={`/login?next=${encodeURIComponent(portalHref)}`}>
                  Returning family sign in
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title} className="rounded-2xl border bg-card p-6 text-center shadow-sm">
              <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--brand)]/12 text-[color:var(--brand)]">
                <step.icon className="h-5 w-5" />
              </span>
              <h2 className="font-extrabold">{step.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
