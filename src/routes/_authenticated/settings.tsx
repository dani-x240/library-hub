import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Fingerprint, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { generateSalt, hashPin, verifyPin, clearUnlocked } from "@/lib/pin";
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

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const hasPin = !!profile?.pin_hash;
  const biometricEnabled = !!profile?.biometric_enabled;

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setLibraryName(profile.library_name ?? "");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, library_name: libraryName })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const signOut = async () => {
    clearUnlocked();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const savePin = async () => {
    if (!user) return;
    if (newPin.length < 4 || newPin.length > 12) {
      return toast.error("PIN must be 4–12 digits");
    }
    if (!/^\d+$/.test(newPin)) return toast.error("PIN must be digits only");
    if (newPin !== confirmPin) return toast.error("PINs do not match");

    setSavingPin(true);
    try {
      if (hasPin) {
        const ok = await verifyPin(
          currentPin,
          profile!.pin_salt!,
          profile!.pin_hash!
        );
        if (!ok) {
          setSavingPin(false);
          return toast.error("Current PIN is incorrect");
        }
      }
      const salt = generateSalt();
      const hash = await hashPin(newPin, salt);
      const { error } = await supabase
        .from("profiles")
        .update({ pin_hash: hash, pin_salt: salt, pin_set_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      toast.success(hasPin ? "PIN updated" : "PIN set — your library is now protected");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save PIN");
    } finally {
      setSavingPin(false);
    }
  };

  const removePin = async () => {
    if (!user || !hasPin) return;
    const ok = await verifyPin(currentPin, profile!.pin_salt!, profile!.pin_hash!);
    if (!ok) return toast.error("Current PIN is incorrect");
    const { error } = await supabase
      .from("profiles")
      .update({ pin_hash: null, pin_salt: null, biometric_enabled: false, pin_set_at: null })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    setCurrentPin("");
    toast.success("PIN removed");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const sendRecovery = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    if (error) return toast.error(error.message);
    toast.success("Recovery email sent. Open the link, then set a new PIN here.");
  };

  const toggleBiometric = async (enabled: boolean) => {
    if (!user) return;
    if (enabled && !hasPin) {
      return toast.error("Set a PIN first — biometric is a backup unlock");
    }
    const { error } = await supabase
      .from("profiles")
      .update({ biometric_enabled: enabled })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success(
      enabled
        ? "Biometric enabled — active inside the installed Android app"
        : "Biometric disabled"
    );
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your account, library, and security</p>
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
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            {hasPin ? <ShieldCheck className="h-5 w-5 text-primary" /> : <ShieldOff className="h-5 w-5 text-muted-foreground" />}
            Security PIN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {hasPin
              ? "A PIN is set. The app asks for it each session."
              : "Protect your library with a 4–12 digit PIN. Required each session."}
          </p>

          {hasPin && (
            <div>
              <Label htmlFor="cur-pin">Current PIN</Label>
              <Input
                id="cur-pin"
                type="password"
                inputMode="numeric"
                maxLength={12}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}

          <div>
            <Label htmlFor="new-pin">{hasPin ? "New PIN" : "Choose PIN"}</Label>
            <Input
              id="new-pin"
              type="password"
              inputMode="numeric"
              maxLength={12}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <Label htmlFor="cf-pin">Confirm PIN</Label>
            <Input
              id="cf-pin"
              type="password"
              inputMode="numeric"
              maxLength={12}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={savePin} disabled={savingPin}>
              {hasPin ? "Update PIN" : "Set PIN"}
            </Button>
            {hasPin && (
              <Button variant="outline" onClick={removePin} disabled={savingPin}>
                Remove PIN
              </Button>
            )}
            <Button variant="ghost" onClick={sendRecovery}>
              Forgot PIN? Email recovery
            </Button>
          </div>

          <div className="mt-4 flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
            <div className="flex items-start gap-3">
              <Fingerprint className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">Biometric unlock (fingerprint / face)</div>
                <p className="text-xs text-muted-foreground">
                  Active inside the installed Android app. In the browser, use your PIN.
                </p>
              </div>
            </div>
            <Switch checked={biometricEnabled} onCheckedChange={toggleBiometric} />
          </div>
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
