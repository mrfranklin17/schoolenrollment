import Link from "next/link";

import { requireStaff } from "@/lib/tenant";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "", label: "Pipeline" },
  { href: "/forms", label: "Forms" },
  { href: "/lottery", label: "Lottery" },
  { href: "/communications", label: "Communications" },
  { href: "/data", label: "Import / Export" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

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
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6 overflow-x-auto">
            <Link href={`/s/${school}/admin`} className="shrink-0 font-semibold">
              {tenant.name}
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={`/s/${school}/admin${item.href}`}
                  className="shrink-0 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
