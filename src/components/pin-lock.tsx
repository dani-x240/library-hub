import { useEffect, useState, type ReactNode } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { verifyPin, markUnlocked, isUnlocked, clearUnlocked } from "@/lib/pin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ProfileSec = { pin_hash: string | null; pin_salt: string | null };

export function PinLock({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<ProfileSec | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("pin_hash, pin_salt")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(data as ProfileSec | null);
      if (!data?.pin_hash) {
        setUnlocked(true);
      } else if (isUnlocked()) {
        setUnlocked(true);
      }
      setChecking(false);
    })();
  }, [user, loading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.pin_hash || !profile.pin_salt) return;
    setBusy(true);
    const ok = await verifyPin(pin, profile.pin_salt, profile.pin_hash);
    setBusy(false);
    if (!ok) {
      setAttempts((a) => a + 1);
      setPin("");
      toast.error("Incorrect PIN");
      return;
    }
    markUnlocked();
    setUnlocked(true);
  };

  const forgotPin = async () => {
    if (!user?.email) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(
      "Recovery link sent. Open it from your email to verify, then reset your PIN in Settings."
    );
  };

  const signOut = async () => {
    clearUnlocked();
    await supabase.auth.signOut();
  };

  if (loading || checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <div className="text-sm">Loading…</div>
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold">Enter PIN</h1>
            <p className="text-xs text-muted-foreground">
              Your library is protected
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              autoFocus
              autoComplete="off"
              maxLength={12}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || pin.length < 4}>
            Unlock
          </Button>
        </form>

        {attempts >= 3 && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Too many wrong attempts. Use email recovery below.</span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={forgotPin}
            disabled={busy}
            className="text-primary underline-offset-2 hover:underline"
          >
            Forgot PIN? Email me
          </button>
          <button
            type="button"
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
