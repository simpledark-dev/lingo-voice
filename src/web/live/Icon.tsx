import type { SVGProps } from "react";

export type IconName =
  | "mic"
  | "mic-off"
  | "hand"
  | "users"
  | "send"
  | "x"
  | "more"
  | "logout"
  | "book"
  | "smile"
  | "chevron-left"
  | "check"
  | "alert";

const PATHS: Record<IconName, string> = {
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM19 11a7 7 0 0 1-14 0M12 18v3M8 21h8",
  "mic-off": "M15 9.3V6a3 3 0 0 0-5.6-1.5M9 9v3a3 3 0 0 0 5.1 2.1M17.7 14.1A7 7 0 0 0 19 11M5 11a7 7 0 0 0 10.4 6.1M12 18v3M8 21h8M4 4l16 16",
  hand: "M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 12V6.5a1.5 1.5 0 0 1 3 0V14.5M8 13l-1.8-2.6a1.5 1.5 0 0 0-2.5 1.7l2.6 5.1A6 6 0 0 0 11.7 21h1.3A4 4 0 0 0 17 17v-2.5",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z",
  x: "M18 6 6 18M6 6l12 12",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  smile: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
  "chevron-left": "M15 18l-6-6 6-6",
  check: "M20 6 9 17l-5-5",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
};

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
