import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Tag, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — LibraryOS" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data: cats = [] } = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data ?? [];
    },
  });

  const add = async () => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("categories").insert({ owner_id: user.id, name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Categories</h1>
        <p className="text-sm text-muted-foreground">Organize your books by genre or subject</p>
      </div>

      <Card>
        <CardContent className="flex gap-2 p-4">
          <Input placeholder="New category (e.g. Fiction, Science)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </CardContent>
      </Card>

      {cats.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Tag className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {cats.map((c) => (
            <Card key={c.id}><CardContent className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-accent" /><span>{c.name}</span></div>
              <Button variant="ghost" size="sm" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
