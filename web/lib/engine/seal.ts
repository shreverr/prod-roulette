/** State travels to the client as an opaque AES-GCM token instead of a database row.
 *  The player holds the blob, the server holds the key: no peeking, no DB, and swapping this
 *  for a Durable Object later is two functions. */
import type { GameState } from "./state";

const SECRET = process.env.GAME_SECRET ?? "prod-roulette-dev-key-not-a-secret";

let cached: Promise<CryptoKey> | null = null;

function key(): Promise<CryptoKey> {
  if (!cached) {
    cached = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(SECRET))
      .then((bits) => crypto.subtle.importKey("raw", bits, "AES-GCM", false, ["encrypt", "decrypt"]));
  }
  return cached;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(token: string): Uint8Array {
  const s = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export async function seal(state: GameState): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new TextEncoder().encode(JSON.stringify(state));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), body));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64urlEncode(out);
}

/** Throws if the token was tampered with, truncated, or sealed under another key. */
export async function unseal(token: string): Promise<GameState> {
  const raw = b64urlDecode(token);
  if (raw.length <= 12) throw new Error("token too short");
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(), ct);
  return JSON.parse(new TextDecoder().decode(plain)) as GameState;
}
