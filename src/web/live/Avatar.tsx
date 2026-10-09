function hueOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({ name, identity, size = 40, speaking = false }: { name: string; identity: string; size?: number; speaking?: boolean }) {
  const hue = hueOf(identity);
  return (
    <span
      className={`lv-avatar${speaking ? " is-speaking" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 40) % 360} 70% 46%))`,
        color: "#fff",
      }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}
