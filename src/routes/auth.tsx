import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Library } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
    return search;
  },
  head: () => ({ meta: [{ title: "Sign in — LibraryOS" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? "signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [libraryName, setLibraryName] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, library_name: libraryName || "My Library" },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — you can now sign in.");
    setTab("signin");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };


  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Library className="h-5 w-5" />
          </div>
          <span className="font-serif text-lg font-semibold">LibraryOS</span>
        </Link>

        <div className="flex-1">
          <h1 className="font-serif text-3xl font-bold">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your library.</p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="email-in">Email</Label>
                  <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pwd-in">Password</Label>
                  <Input id="pwd-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Sign in</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lib">Library name</Label>
                  <Input id="lib" placeholder="e.g. Riverside Community Library" value={libraryName} onChange={(e) => setLibraryName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pwd-up">Password</Label>
                  <Input id="pwd-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Create account</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
