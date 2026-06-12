import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { requireStaff } from "@/lib/tenant";
import { signOut } from "@/lib/auth/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  const { tenant } = await requireStaff(school);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar (top bar on mobile) */}
      <aside className="bg-navy text-navy-foreground md:flex md:w-60 md:shrink-0 md:flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-4 md:block">
          <Link href={`/s/${school}/admin`} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--brand)] text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold leading-tight text-white">
                {tenant.name}
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/50">
                Admissions
              </span>
            </span>
          </Link>
          <form action={signOut} className="md:hidden">
            <Button variant="ghost" size="sm" className="text-white/70 hover:bg-white/10 hover:text-white">
              Sign out
            </Button>
          </form>
        </div>
        <div className="px-3 pb-3 md:flex-1 md:pb-4">
          <AdminNav school={school} />
        </div>
        <div className="hidden border-t border-white/10 px-3 py-3 md:block">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/s/${school}`}
              className="truncate text-xs font-semibold text-white/55 hover:text-white"
            >
              View family page ↗
            </Link>
            <form action={signOut}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
              >
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
