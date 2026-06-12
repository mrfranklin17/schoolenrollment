import Link from "next/link";
import { CheckCircle2, GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";

const FEATURES = [
  "Custom application forms with conditional logic",
  "Parent-friendly portal — apply from any phone",
  "Document collection with verification workflow",
  "Auditable lotteries, waitlists, and expiring offers",
  "Bulk email with per-family personalization",
  "OneRoster & CSV export to your SIS",
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-extrabold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4.5 w-4.5" />
            </span>
            Enrollly
          </span>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/onboarding">Start free trial</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-navy text-navy-foreground">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:py-28">
            <p className="mb-4 inline-block rounded-full bg-mint/20 px-4 py-1 text-sm font-bold text-mint">
              Built for private, charter & micro schools
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              School enrollment without the headache
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/75">
              Everything you need to run admissions — custom forms, a parent portal families
              love, document collection, lotteries, and waitlists — at a price that makes sense.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="font-bold">
                <Link href="/onboarding">Start your 14-day free trial</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white/40 bg-transparent font-bold text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">Parent sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-14">
          <h2 className="text-center text-2xl font-extrabold">
            Everything admissions, nothing extra
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint" />
                <span className="text-sm font-semibold">{feature}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Enrollly
      </footer>
    </div>
  );
}
