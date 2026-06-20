import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, UserRound, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "Members — LibraryOS" }] }),
  component: MembersPage,
});

type Member = {
  id: string; membership_no: string; full_name: string;
  email: string | null; phone: string | null; address: string | null;
  status: string; notes: string | null;
};

function MembersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [f, setF] = useState<Partial<Member>>({});

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").order("full_name");
      if (error) throw error;
      return data as Member[];
    },
  });

  const filtered = members.filter((m) => {
    const s = q.toLowerCase();
    return !s || m.full_name.toLowerCase().includes(s) || m.membership_no.toLowerCase().includes(s) || (m.email ?? "").toLowerCase().includes(s);
  });

  const openNew = () => {
    setEditing(null);
    setF({ status: "active", membership_no: `M${String(members.length + 1).padStart(4, "0")}` });
    setOpen(true);
  };
  const openEdit = (m: Member) => { setEditing(m); setF(m); setOpen(true); };

  const save = async () => {
    if (!user || !f.full_name || !f.membership_no) return toast.error("Name and membership # required");
    const payload = {
      owner_id: user.id,
      full_name: f.full_name,
      membership_no: f.membership_no,
      email: f.email || null,
      phone: f.phone || null,
      address: f.address || null,
      status: f.status || "active",
      notes: f.notes || null,
    };
    const res = editing
      ? await supabase.from("members").update(payload).eq("id", editing.id)
      : await supabase.from("members").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Updated" : "Added");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this member?")) return;
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">Your library patrons</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add member</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search name, ID or email…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <UserRound className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No members yet.</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/30 font-serif text-base font-semibold text-accent-foreground">
                    {m.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-medium">{m.full_name}</div>
                      <Badge variant={m.status === "active" ? "secondary" : "outline"}>{m.status}</Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{m.membership_no} · {m.email ?? "no email"}</div>
                    {m.phone && <div className="text-xs text-muted-foreground">{m.phone}</div>}
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif">{editing ? "Edit member" : "Add member"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Full name *</Label><Input value={f.full_name ?? ""} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
              <div><Label>Membership # *</Label><Input value={f.membership_no ?? ""} onChange={(e) => setF({ ...f, membership_no: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
            <div><Label>Status</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={f.status ?? "active"} onChange={(e) => setF({ ...f, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
