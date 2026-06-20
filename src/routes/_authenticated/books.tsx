import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, BookOpen, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/books")({
  head: () => ({ meta: [{ title: "Books — LibraryOS" }] }),
  component: BooksPage,
});

type Book = {
  id: string; title: string; author: string | null; isbn: string | null;
  category_id: string | null; publisher: string | null; published_year: number | null;
  shelf_location: string | null; cover_url: string | null; description: string | null;
  total_copies: number; available_copies: number;
};

function BooksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["books", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").order("title");
      if (error) throw error;
      return data as Book[];
    },
  });

  const { data: cats = [] } = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").order("name");
      return data ?? [];
    },
  });

  const filtered = books.filter((b) => {
    const s = q.toLowerCase();
    return !s || b.title.toLowerCase().includes(s) || (b.author ?? "").toLowerCase().includes(s) || (b.isbn ?? "").includes(s);
  });

  const onDelete = async (id: string) => {
    if (!confirm("Delete this book?")) return;
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["books"] });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">Books</h1>
          <p className="text-sm text-muted-foreground">Your catalog</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Add book
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search title, author or ISBN…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No books yet. Add your first one.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex gap-3 p-4">
                <div className="grid h-20 w-14 shrink-0 place-items-center rounded bg-muted">
                  {b.cover_url ? <img src={b.cover_url} alt="" className="h-full w-full rounded object-cover" /> : <BookOpen className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-serif text-base font-semibold">{b.title}</div>
                  <div className="truncate text-sm text-muted-foreground">{b.author ?? "Unknown author"}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                    <Badge variant="secondary">{b.available_copies}/{b.total_copies} available</Badge>
                    {b.shelf_location && <Badge variant="outline">Shelf {b.shelf_location}</Badge>}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BookDialog open={open} onOpenChange={setOpen} editing={editing} cats={cats} userId={user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["books"] })} />
    </div>
  );
}

function BookDialog({ open, onOpenChange, editing, cats, userId, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Book | null;
  cats: { id: string; name: string }[]; userId?: string; onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Book>>({});
  const [saving, setSaving] = useState(false);

  // reset on open
  if (open && f && editing && f.id !== editing.id) {
    // sync once
    queueMicrotask(() => setF(editing));
  } else if (open && !editing && f.id) {
    queueMicrotask(() => setF({ total_copies: 1, available_copies: 1 }));
  }

  const save = async () => {
    if (!userId || !f.title) return toast.error("Title is required");
    setSaving(true);
    const payload = {
      owner_id: userId,
      title: f.title,
      author: f.author ?? null,
      isbn: f.isbn ?? null,
      category_id: f.category_id || null,
      publisher: f.publisher ?? null,
      published_year: f.published_year ? Number(f.published_year) : null,
      shelf_location: f.shelf_location ?? null,
      cover_url: f.cover_url ?? null,
      description: f.description ?? null,
      total_copies: Number(f.total_copies ?? 1),
      available_copies: Number(f.available_copies ?? f.total_copies ?? 1),
    };
    const res = editing
      ? await supabase.from("books").update(payload).eq("id", editing.id)
      : await supabase.from("books").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Updated" : "Added");
    onOpenChange(false);
    setF({});
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setF({}); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-serif">{editing ? "Edit book" : "Add book"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title *</Label><Input value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Author</Label><Input value={f.author ?? ""} onChange={(e) => setF({ ...f, author: e.target.value })} /></div>
            <div><Label>ISBN</Label><Input value={f.isbn ?? ""} onChange={(e) => setF({ ...f, isbn: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Publisher</Label><Input value={f.publisher ?? ""} onChange={(e) => setF({ ...f, publisher: e.target.value })} /></div>
            <div><Label>Year</Label><Input type="number" value={f.published_year ?? ""} onChange={(e) => setF({ ...f, published_year: e.target.value ? Number(e.target.value) : null })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label>
              <Select value={f.category_id ?? "none"} onValueChange={(v) => setF({ ...f, category_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— none —</SelectItem>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Shelf</Label><Input value={f.shelf_location ?? ""} onChange={(e) => setF({ ...f, shelf_location: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Total copies</Label><Input type="number" min={1} value={f.total_copies ?? 1} onChange={(e) => setF({ ...f, total_copies: Number(e.target.value) })} /></div>
            <div><Label>Available copies</Label><Input type="number" min={0} value={f.available_copies ?? 1} onChange={(e) => setF({ ...f, available_copies: Number(e.target.value) })} /></div>
          </div>
          <div><Label>Cover image URL</Label><Input value={f.cover_url ?? ""} onChange={(e) => setF({ ...f, cover_url: e.target.value })} placeholder="https://…" /></div>
          <div><Label>Description</Label><Textarea rows={3} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{editing ? "Save" : "Add book"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
