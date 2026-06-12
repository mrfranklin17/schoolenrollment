import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import { GraduationCap } from "lucide-react";

import { requireMember } from "@/lib/tenant";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  const { tenant } = await requireMember(school);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-[color:var(--brand)] text-white">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4">
          <Link href={`/s/${school}/portal`} className="flex min-w-0 items-center gap-2.5">
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt=""
                className="h-9 w-9 rounded-lg bg-white object-contain p-1"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                <GraduationCap className="h-5 w-5" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-extrabold leading-tight">{tenant.name}</span>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/70">
                Family portal
              </span>
            </span>
          </Link>
          <form action={signOut}>
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              className="text-white/85 hover:bg-white/15 hover:text-white"
            >
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      <footer className="py-5 text-center text-xs text-muted-foreground">
        Powered by Enrollly
      </footer>
    </div>
  );
}
