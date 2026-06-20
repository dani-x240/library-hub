import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Users, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LibraryOS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [books, members, active, overdue] = await Promise.all([
        supabase.from("books").select("*", { count: "exact", head: true }),
        supabase.from("members").select("*", { count: "exact", head: true }),
        supabase.from("borrowings").select("*", { count: "exact", head: true }).eq("status", "borrowed"),
        supabase.from("borrowings").select("*", { count: "exact", head: true }).eq("status", "borrowed").lt("due_at", nowIso),
      ]);
      return {
        books: books.count ?? 0,
        members: members.count ?? 0,
        active: active.count ?? 0,
        overdue: overdue.count ?? 0,
      };
    },
  });

  const cards = [
    { t: "Books", v: stats?.books ?? 0, i: BookOpen, c: "text-amber-700" },
    { t: "Members", v: stats?.members ?? 0, i: Users, c: "text-emerald-700" },
    { t: "Active loans", v: stats?.active ?? 0, i: ArrowLeftRight, c: "text-sky-700" },
    { t: "Overdue", v: stats?.overdue ?? 0, i: AlertTriangle, c: "text-red-700" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-serif text-3xl font-bold">{profile?.library_name ?? "My Library"}</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.t}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.t}</CardTitle>
              <c.i className={`h-4 w-4 ${c.c}`} />
            </CardHeader>
            <CardContent>
              <div className="font-serif text-3xl font-bold">{c.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif">Quick start</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Add a few <span className="text-foreground font-medium">Books</span> to your catalog.</p>
          <p>2. Register your <span className="text-foreground font-medium">Members</span>.</p>
          <p>3. Issue a <span className="text-foreground font-medium">Borrowing</span> when someone takes a book.</p>
          <p>4. Mark it returned — fines auto-calculate if overdue.</p>
        </CardContent>
      </Card>
    </div>
  );
}
