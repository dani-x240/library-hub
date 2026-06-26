// PIN hashing using PBKDF2 + Web Crypto. Never store the raw PIN.

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function generateSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toHex(salt.buffer);
}

export async function hashPin(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromHex(saltHex),
      iterations: 150_000,
      hash: "SHA-256",
    },
    baseKey,
    256
  );
  return toHex(bits);
}

export async function verifyPin(
  pin: string,
  saltHex: string,
  expectedHash: string
): Promise<boolean> {
  const h = await hashPin(pin, saltHex);
  return h === expectedHash;
}

const UNLOCK_KEY = "lms:pin_unlocked_at";
const UNLOCK_TTL_MS = 1000 * 60 * 30; // 30 min

export function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
  } catch {}
}

export function isUnlocked(): boolean {
  try {
    const v = sessionStorage.getItem(UNLOCK_KEY);
    if (!v) return false;
    return Date.now() - Number(v) < UNLOCK_TTL_MS;
  } catch {
    return false;
  }
}

export function clearUnlocked() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {}
}
