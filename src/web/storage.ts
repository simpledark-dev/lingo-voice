/**
 * Browser persistence for identity and display name.
 *
 * Identity lives in sessionStorage: it survives a refresh (so the server replaces
 * the stale connection instead of showing a duplicate) but differs per tab (so two
 * tabs can be used for local testing). Display name lives in localStorage.
 */
import { generateIdentity, identitySchema } from "@/core/validation";

const IDENTITY_KEY = "lingo-voice.identity";
const NAME_KEY = "lingo-voice.displayName";

let memoryIdentity: string | null = null;

export function getOrCreateIdentity(): string {
  try {
    const existing = window.sessionStorage.getItem(IDENTITY_KEY);
    if (existing && identitySchema.safeParse(existing).success) return existing;
    const fresh = generateIdentity();
    window.sessionStorage.setItem(IDENTITY_KEY, fresh);
    return fresh;
  } catch {
    if (!memoryIdentity) memoryIdentity = generateIdentity();
    return memoryIdentity;
  }
}

export function loadDisplayName(): string | null {
  try {
    const value = window.localStorage.getItem(NAME_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function saveDisplayName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore (private mode / storage disabled)
  }
}
