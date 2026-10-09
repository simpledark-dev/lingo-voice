"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatEntry } from "@/core/messages";
import { Icon } from "./Icon";

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ChatMessages({ messages, hostIdentity, myIdentity, canModerate, onDelete }: { messages: ChatEntry[]; hostIdentity: string | null; myIdentity: string | null; canModerate: boolean; onDelete: (id: string) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom) el.scrollTop = el.scrollHeight;
  }, [messages, stickToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setStickToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  const visible = messages.filter((m) => !m.deleted);
  return (
    <div className="lv-chat-list" ref={listRef} onScroll={onScroll} data-testid="chat-list">
      {visible.length === 0 ? (
        <p className="lv-muted lv-chat-empty">Say hello. Everyone in the room can see the chat.</p>
      ) : (
        visible.map((m) => (
          <div key={m.id} className={`lv-msg${m.from.identity === myIdentity ? " is-mine" : ""}`} data-testid="chat-message" data-id={m.id}>
            <span className={`lv-msg-author${m.from.identity === hostIdentity ? " is-host" : ""}`}>{m.from.name}</span>
            <span className="lv-msg-text">{m.text}</span>
            <span className="lv-msg-time">{timeOf(m.at)}</span>
            {canModerate && (
              <button className="lv-msg-delete" aria-label="Delete message" data-testid="chat-delete" onClick={() => onDelete(m.id)}>
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export function ChatInput({ canSend, disabledReason, onSend, placeholder = "Message" }: { canSend: boolean; disabledReason?: string; onSend: (text: string) => Promise<void>; placeholder?: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !canSend) return;
    setSending(true);
    try {
      await onSend(value);
      setText("");
    } finally {
      setSending(false);
    }
  };
  return (
    <form className="lv-chat-form" onSubmit={submit}>
      <input
        data-testid="chat-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={canSend ? placeholder : disabledReason ?? "Chat unavailable"}
        maxLength={500}
        disabled={!canSend}
        autoComplete="off"
        enterKeyHint="send"
      />
      <button type="submit" className="lv-iconbtn lv-iconbtn-primary" aria-label="Send" data-testid="chat-send" disabled={!canSend || sending || !text.trim()}>
        <Icon name="send" size={18} />
      </button>
    </form>
  );
}
