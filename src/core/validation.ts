import { z } from "zod";
import { PARTICIPANT_ROLES } from "./types";

/** 3-64 chars, starts alphanumeric, then letters / digits / "-" / "_". */
export const SAFE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/;

export const sessionIdSchema = z
  .string()
  .trim()
  .regex(SAFE_ID_PATTERN, "Session ID must be 3-64 characters: letters, digits, '-' or '_'");

export const identitySchema = z
  .string()
  .trim()
  .regex(SAFE_ID_PATTERN, "Identity must be 3-64 characters: letters, digits, '-' or '_'");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required")
  .max(40, "Display name must be at most 40 characters");

export const roleSchema = z.enum(PARTICIPANT_ROLES);

export const tokenRequestSchema = z.object({
  sessionId: sessionIdSchema,
  displayName: displayNameSchema,
  identity: identitySchema.optional(),
  role: roleSchema.optional(),
});

export type TokenRequestInput = z.input<typeof tokenRequestSchema>;

const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i to avoid read-aloud confusion

function randomChars(length: number): string {
  const out: string[] = [];
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      out.push(ID_ALPHABET[bytes[i]! % ID_ALPHABET.length]!);
    }
  } else {
    for (let i = 0; i < length; i++) {
      out.push(ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]!);
    }
  }
  return out.join("");
}

/** Human-shareable session id, e.g. "k7mq-x2pa". */
export function generateSessionId(): string {
  return `${randomChars(4)}-${randomChars(4)}`;
}

/** Opaque participant identity, e.g. "p-8fk2m3qz7t4w". */
export function generateIdentity(): string {
  return `p-${randomChars(12)}`;
}

export function normalizeSessionId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidSessionId(raw: string): boolean {
  return sessionIdSchema.safeParse(raw).success;
}
