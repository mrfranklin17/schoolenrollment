import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <span className="font-semibold">Enrollly</span>
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
      <main className="flex flex-1 items-center">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            School enrollment without the headache
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Custom application forms, a parent-friendly portal, document collection, lotteries,
            and waitlists — everything private, charter, and micro schools need to run
            admissions, at a price that makes sense.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/onboarding">Start your 14-day free trial</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Parent sign in</Link>
            </Button>
          </div>
        </div>
      </main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Enrollly
      </footer>
    </div>
  );
}
