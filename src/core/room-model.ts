/**
 * Product model for a live practice room. Platform independent.
 *
 * A room IS a LiveKit room. Its product state lives in the LiveKit room metadata
 * (written only by our server), so every client receives it live and nothing
 * needs a database for this pass.
 */
import { z } from "zod";
import { displayNameSchema, identitySchema } from "./validation";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "vi", label: "Vietnamese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];
export const languageSchema = z.enum(LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]]);

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];
export const levelSchema = z.enum(LEVELS);

export const passageSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(4000),
  language: languageSchema,
  level: levelSchema.optional(),
  source: z.enum(["library", "custom"]),
});
export type Passage = z.infer<typeof passageSchema>;

export const ROOM_METADATA_KIND = "lingo-room";

export const roomMetadataSchema = z.object({
  v: z.literal(1),
  kind: z.literal(ROOM_METADATA_KIND),
  title: z.string().trim().min(1).max(80),
  language: languageSchema,
  level: levelSchema,
  /** The host's user id (also their LiveKit identity) and display name. */
  host: z.object({ identity: identitySchema, name: displayNameSchema }),
  passage: passageSchema.nullable(),
  /** Identities currently invited on stage (host excluded). */
  stage: z.array(identitySchema).max(50),
  /** Identities whose chat has been muted by the host. */
  chatMuted: z.array(identitySchema).max(500),
  createdAt: z.string(),
});
export type RoomMetadata = z.infer<typeof roomMetadataSchema>;

export function parseRoomMetadata(raw: string | null | undefined): RoomMetadata | null {
  if (!raw) return null;
  try {
    const parsed = roomMetadataSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeRoomMetadata(metadata: RoomMetadata): string {
  return JSON.stringify(metadata);
}

/** Participant attribute set by a listener who wants to speak. Value: ISO time it was raised. */
export const HAND_ATTRIBUTE_KEY = "lingo.hand";

export type StageRole = "host" | "speaker" | "listener";

export function stageRoleOf(identity: string, metadata: RoomMetadata | null, canPublish?: boolean | null): StageRole {
  if (metadata?.host.identity === identity) return "host";
  if (metadata?.stage.includes(identity)) return "speaker";
  if (!metadata && canPublish) return "speaker";
  return "listener";
}

/** What the lobby shows. */
export interface RoomSummary {
  id: string;
  title: string;
  language: LanguageCode;
  level: Level;
  host: { identity: string; name: string };
  participantCount: number;
  createdAt: string;
  passageTitle: string | null;
}

export interface RoomDetails extends RoomSummary {
  passage: Passage | null;
  stage: string[];
}

export function toRoomSummary(id: string, metadata: RoomMetadata, participantCount: number): RoomSummary {
  return {
    id,
    title: metadata.title,
    language: metadata.language,
    level: metadata.level,
    host: metadata.host,
    participantCount,
    createdAt: metadata.createdAt,
    passageTitle: metadata.passage?.title ?? null,
  };
}

export function toRoomDetails(id: string, metadata: RoomMetadata, participantCount: number): RoomDetails {
  return { ...toRoomSummary(id, metadata, participantCount), passage: metadata.passage, stage: metadata.stage };
}

// --- API payloads -----------------------------------------------------------

export const createRoomRequestSchema = z.object({
  title: z.string().trim().min(1).max(80),
  language: languageSchema,
  level: levelSchema,
  /** A library passage id, or a custom passage. Defaults to the library default for language/level. */
  passageId: z.string().min(1).max(64).optional(),
  customPassage: z.object({ title: z.string().trim().min(1).max(120), text: z.string().trim().min(1).max(4000) }).optional(),
});
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;

export interface CreateRoomResponse {
  room: RoomDetails;
}

export const hostActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set-passage"), passage: passageSchema }),
  z.object({ action: z.literal("invite"), identity: identitySchema }),
  z.object({ action: z.literal("remove-from-stage"), identity: identitySchema }),
  z.object({ action: z.literal("mute"), identity: identitySchema }),
  z.object({ action: z.literal("remove-participant"), identity: identitySchema }),
  z.object({ action: z.literal("set-chat-muted"), identity: identitySchema, muted: z.boolean() }),
  z.object({ action: z.literal("end") }),
]);
export type HostAction = z.infer<typeof hostActionSchema>;
