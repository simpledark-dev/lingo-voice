"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { passagesFor } from "@/core/passages";
import { LANGUAGES, LEVELS, languageLabel, type CreateRoomResponse, type LanguageCode, type Level } from "@/core/room-model";
import { Icon } from "@/web/live/Icon";
import { useAccount } from "@/web/account/AccountProvider";
import { NameEditor } from "./NameEditor";

export function CreateRoomForm() {
  const router = useRouter();
  const { me, rename } = useAccount();
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [level, setLevel] = useState<Level>("beginner");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [passageId, setPassageId] = useState<string | "custom">("");
  const [customTitle, setCustomTitle] = useState("");
  const [customText, setCustomText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => passagesFor(language), [language]);
  useEffect(() => {
    if (passageId === "custom") return;
    const preferred = passagesFor(language, level)[0] ?? options[0];
    setPassageId(preferred?.id ?? "");
  }, [language, level, options, passageId === "custom"]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedTitle = `${languageLabel(language)} practice`;
  const effectiveTitle = titleTouched ? title : suggestedTitle;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!me) return setError("Still signing you in, try again in a second.");
    if (passageId === "custom" && (!customTitle.trim() || !customText.trim())) return setError("Give your custom passage a title and some text.");
    setBusy(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: effectiveTitle.trim() || suggestedTitle,
          language,
          level,
          ...(passageId === "custom" ? { customPassage: { title: customTitle.trim(), text: customText.trim() } } : { passageId }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Could not create the room (${res.status})`);
      }
      const body = (await res.json()) as CreateRoomResponse;
      router.push(`/room/${body.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the room");
      setBusy(false);
    }
  };

  return (
    <main className="lv-page lv-narrow">
      <Link href="/" className="lv-backlink">
        <Icon name="chevron-left" size={16} /> All rooms
      </Link>
      <h1>Create a room</h1>
      <p className="lv-muted">You host: pick the passage, invite learners to read, and give feedback.</p>
      <div className="lv-hosting-as">
        <NameEditor me={me} onRename={rename} />
      </div>
      <form className="lv-card lv-form" onSubmit={submit}>
        <div className="lv-form-row">
          <label>
            Language
            <select data-testid="create-language" value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Level
            <select data-testid="create-level" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Room title
          <input
            data-testid="create-title"
            value={effectiveTitle}
            maxLength={80}
            onChange={(e) => {
              setTitleTouched(true);
              setTitle(e.target.value);
            }}
          />
        </label>
        <fieldset className="lv-fieldset">
          <legend>Reading passage</legend>
          {options.map((p) => (
            <label key={p.id} className={`lv-radio${passageId === p.id ? " is-selected" : ""}`}>
              <input type="radio" name="passage" value={p.id} checked={passageId === p.id} onChange={() => setPassageId(p.id)} />
              <span className="lv-radio-body">
                <span className="lv-radio-title">
                  {p.title} <span className="lv-tag">{p.level}</span>
                </span>
                <span className="lv-radio-text">{p.text}</span>
              </span>
            </label>
          ))}
          <label className={`lv-radio${passageId === "custom" ? " is-selected" : ""}`}>
            <input type="radio" name="passage" value="custom" checked={passageId === "custom"} onChange={() => setPassageId("custom")} />
            <span className="lv-radio-body">
              <span className="lv-radio-title">Custom text</span>
              <span className="lv-radio-text">Paste your own passage.</span>
            </span>
          </label>
          {passageId === "custom" && (
            <div className="lv-form lv-indent">
              <label>
                Title
                <input value={customTitle} maxLength={120} onChange={(e) => setCustomTitle(e.target.value)} />
              </label>
              <label>
                Text
                <textarea value={customText} maxLength={4000} rows={6} onChange={(e) => setCustomText(e.target.value)} />
              </label>
            </div>
          )}
        </fieldset>
        {error && (
          <div className="lv-banner lv-banner-error" role="alert">
            <Icon name="alert" size={16} /> <span>{error}</span>
          </div>
        )}
        <button type="submit" className="lv-btn lv-btn-primary lv-btn-large" data-testid="create-submit" disabled={busy || !me}>
          {busy ? "Creating…" : "Create and open room"}
        </button>
      </form>
    </main>
  );
}
