/**
 * Live in-room messages carried over LiveKit data channels: chat, chat moderation,
 * chat history (host -> newcomer) and reactions. Sender identity always comes from
 * the LiveKit packet, never from the payload, so it cannot be spoofed.
 */
import { z } from "zod";
import { displayNameSchema, identitySchema } from "./validation";

export const LIVE_TOPIC = "lingo.live";

/** Reaction set required by the product spec; rendered as floating glyphs, not as UI icons. */
export const REACTIONS = ["❤️", "👍", "👏", "😮", "😂"] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];
export const reactionSchema = z.enum(REACTIONS);

export const CHAT_MAX_LENGTH = 500;
export const CHAT_HISTORY_MAX = 50;

const chatIdSchema = z.string().min(1).max(40);
const chatTextSchema = z.string().trim().min(1).max(CHAT_MAX_LENGTH);

export const chatEntrySchema = z.object({
  id: chatIdSchema,
  text: chatTextSchema,
  at: z.number().int().nonnegative(),
  from: z.object({ identity: identitySchema, name: displayNameSchema }),
});
export type ChatEntry = z.infer<typeof chatEntrySchema> & { deleted?: boolean };

export const liveMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chat"), id: chatIdSchema, text: chatTextSchema, at: z.number().int().nonnegative() }),
  z.object({ type: z.literal("chat.delete"), id: chatIdSchema }),
  z.object({ type: z.literal("chat.history"), messages: z.array(chatEntrySchema).max(CHAT_HISTORY_MAX) }),
  z.object({ type: z.literal("reaction"), emoji: reactionSchema }),
]);
export type LiveMessage = z.infer<typeof liveMessageSchema>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeLiveMessage(message: LiveMessage): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify(message)) as Uint8Array<ArrayBuffer>;
}

export function decodeLiveMessage(payload: Uint8Array): LiveMessage | null {
  try {
    const parsed = liveMessageSchema.safeParse(JSON.parse(decoder.decode(payload)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function newChatId(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID().slice(0, 32);
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
