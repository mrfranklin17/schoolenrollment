import Link from "next/link";
/* eslint-disable @next/next/no-img-element */

import { getTenantBySlug, getUser } from "@/lib/tenant";
import { Button } from "@/components/ui/button";

export default async function SchoolLandingPage({
  params,
}: {
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  const [tenant, user] = await Promise.all([getTenantBySlug(school), getUser()]);

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="max-w-xl py-24 text-center">
        {tenant.logo_url && (
          <img
            src={tenant.logo_url}
            alt={`${tenant.name} logo`}
            className="mx-auto mb-6 h-20 w-auto"
          />
        )}
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{tenant.name}</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Apply for enrollment, track your application, and upload required documents — all in
          one place.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href={user ? `/s/${school}/portal` : `/signup?next=${encodeURIComponent(`/s/${school}/portal`)}`}>
              {user ? "Go to family portal" : "Start an application"}
            </Link>
          </Button>
          {!user && (
            <Button size="lg" variant="outline" asChild>
              <Link href={`/login?next=${encodeURIComponent(`/s/${school}/portal`)}`}>
                Returning family sign in
              </Link>
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
