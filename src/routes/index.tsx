import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { BookOpen, Users, ArrowLeftRight, BarChart3, Library, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LibraryOS — Mobile-first Library Management" },
      { name: "description", content: "Track books, members, and borrowings from your phone or desktop. Built for libraries, schools, and resource centers." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Library className="h-5 w-5" />
            </div>
            <span className="font-serif text-lg font-semibold">LibraryOS</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" />
              Built for libraries, schools, and resource centers
            </div>
            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
              Run your library from your phone.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              Catalog books, register members, track borrowings and fines — all in one warm, simple workspace that works on Android, tablets, and desktop.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Create your library</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/auth">I already have an account</Link></Button>
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-4">
            {[
              { i: BookOpen, t: "Book catalog", d: "Add books with cover, ISBN, shelf, and copies." },
              { i: Users, t: "Members", d: "Register patrons and issue membership numbers." },
              { i: ArrowLeftRight, t: "Borrow & return", d: "One-tap checkout with due dates and fines." },
              { i: BarChart3, t: "Dashboard", d: "See active loans, overdue, and stock at a glance." },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-border bg-card p-5">
                <f.i className="h-6 w-6 text-accent" />
                <div className="mt-3 font-semibold">{f.t}</div>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LibraryOS
      </footer>
    </div>
  );
}
