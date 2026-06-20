import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ArrowLeftRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/borrowings")({
  head: () => ({ meta: [{ title: "Borrowings — LibraryOS" }] }),
  component: BorrowingsPage,
});

const FINE_PER_DAY = 50; // configurable later in settings

type Borrowing = {
  id: string; book_id: string; member_id: string;
  borrowed_at: string; due_at: string; returned_at: string | null;
  status: string; fine_amount: number;
  books?: { title: string } | null;
  members?: { full_name: string; membership_no: string } | null;
};

function BorrowingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "returned">("active");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["borrowings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrowings")
        .select("*, books(title), members(full_name, membership_no)")
        .order("borrowed_at", { ascending: false });
      if (error) throw error;
      return data as Borrowing[];
    },
  });

  const now = Date.now();
  const active = rows.filter((r) => r.status === "borrowed");
  const returned = rows.filter((r) => r.status === "returned");

  const markReturned = async (r: Borrowing) => {
    const overdueMs = Date.now() - new Date(r.due_at).getTime();
    const days = Math.max(0, Math.ceil(overdueMs / 86_400_000));
    const fine = days * FINE_PER_DAY;
    const { error } = await supabase.from("borrowings").update({
      returned_at: new Date().toISOString(),
      status: "returned",
      fine_amount: fine,
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
    // bump available copies
    const { data: book } = await supabase.from("books").select("available_copies, total_copies").eq("id", r.book_id).maybeSingle();
    if (book) {
      await supabase.from("books").update({
        available_copies: Math.min(book.total_copies, (book.available_copies ?? 0) + 1),
      }).eq("id", r.book_id);
    }
    toast.success(fine > 0 ? `Returned · fine ${fine}` : "Returned");
    qc.invalidateQueries({ queryKey: ["borrowings"] });
    qc.invalidateQueries({ queryKey: ["books"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const List = ({ items }: { items: Borrowing[] }) =>
    items.length === 0 ? (
      <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <ArrowLeftRight className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      </CardContent></Card>
    ) : (
      <div className="grid gap-3">
        {items.map((r) => {
          const overdue = r.status === "borrowed" && new Date(r.due_at).getTime() < now;
          return (
            <Card key={r.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate font-serif text-base font-semibold">{r.books?.title ?? "Book"}</div>
                  <div className="truncate text-sm text-muted-foreground">{r.members?.full_name} · {r.members?.membership_no}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                    <Badge variant="outline">Borrowed {new Date(r.borrowed_at).toLocaleDateString()}</Badge>
                    <Badge variant={overdue ? "destructive" : "secondary"}>Due {new Date(r.due_at).toLocaleDateString()}</Badge>
                    {r.returned_at && <Badge>Returned {new Date(r.returned_at).toLocaleDateString()}</Badge>}
                    {r.fine_amount > 0 && <Badge variant="destructive">Fine {r.fine_amount}</Badge>}
                    {overdue && <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle className="h-3 w-3" />Overdue</span>}
                  </div>
                </div>
                {r.status === "borrowed" && (
                  <Button size="sm" onClick={() => markReturned(r)}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />Return
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">Borrowings</h1>
          <p className="text-sm text-muted-foreground">Issue and return books</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New borrowing</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "returned")}>
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="returned">History ({returned.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-3">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <List items={active} />}
        </TabsContent>
        <TabsContent value="returned" className="mt-3">
          <List items={returned} />
        </TabsContent>
      </Tabs>

      <NewBorrowingDialog open={open} onOpenChange={setOpen} userId={user?.id} onSaved={() => {
        qc.invalidateQueries({ queryKey: ["borrowings"] });
        qc.invalidateQueries({ queryKey: ["books"] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      }} />
    </div>
  );
}

function NewBorrowingDialog({ open, onOpenChange, userId, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; userId?: string; onSaved: () => void;
}) {
  const [bookId, setBookId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [days, setDays] = useState(14);
  const [saving, setSaving] = useState(false);

  const { data: books = [] } = useQuery({
    queryKey: ["books-options"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("books").select("id, title, available_copies").gt("available_copies", 0).order("title");
      return data ?? [];
    },
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members-options"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, full_name, membership_no").eq("status", "active").order("full_name");
      return data ?? [];
    },
  });

  const save = async () => {
    if (!userId || !bookId || !memberId) return toast.error("Pick a book and member");
    setSaving(true);
    const dueAt = new Date(Date.now() + days * 86_400_000).toISOString();
    const { error } = await supabase.from("borrowings").insert({
      owner_id: userId, book_id: bookId, member_id: memberId, due_at: dueAt, status: "borrowed",
    });
    if (error) { setSaving(false); return toast.error(error.message); }
    const { data: book } = await supabase.from("books").select("available_copies").eq("id", bookId).maybeSingle();
    if (book) await supabase.from("books").update({ available_copies: Math.max(0, (book.available_copies ?? 1) - 1) }).eq("id", bookId);
    setSaving(false);
    toast.success("Book issued");
    onOpenChange(false);
    setBookId(""); setMemberId(""); setDays(14);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-serif">Issue a book</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Book</Label>
            <Select value={bookId} onValueChange={setBookId}>
              <SelectTrigger><SelectValue placeholder="Choose a book…" /></SelectTrigger>
              <SelectContent>
                {books.map((b) => <SelectItem key={b.id} value={b.id}>{b.title} ({b.available_copies} avail.)</SelectItem>)}
                {books.length === 0 && <div className="p-2 text-xs text-muted-foreground">No books available</div>}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger><SelectValue placeholder="Choose a member…" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name} · {m.membership_no}</SelectItem>)}
                {members.length === 0 && <div className="p-2 text-xs text-muted-foreground">No active members</div>}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Loan period (days)</Label><Input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} /></div>
          <p className="text-xs text-muted-foreground">Late returns auto-calculate a fine of {FINE_PER_DAY} per day.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>Issue book</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
