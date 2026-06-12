"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Database,
  FileText,
  KanbanSquare,
  Mail,
  Settings,
  Ticket,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "", label: "Pipeline", icon: KanbanSquare, exact: true },
  { href: "/forms", label: "Forms", icon: FileText },
  { href: "/lottery", label: "Lottery & Waitlist", icon: Ticket },
  { href: "/communications", label: "Communications", icon: Mail },
  { href: "/data", label: "Import / Export", icon: Database },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AdminNav({ school }: { school: string }) {
  const pathname = usePathname();
  const base = `/s/${school}/admin`;

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {NAV.map((item) => {
        const href = `${base}${item.href}`;
        const active = item.exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-white/15 text-white"
                : "text-white/65 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
