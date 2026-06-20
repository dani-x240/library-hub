import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — LibraryOS" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [libraryName, setLibraryName] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setLibraryName(profile.library_name ?? "");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: fullName, library_name: libraryName,
    }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your account and library</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif">Profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div><Label>Your name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>Library name</Label><Input value={libraryName} onChange={(e) => setLibraryName(e.target.value)} /></div>
          <Button onClick={save}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-serif">Session</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
