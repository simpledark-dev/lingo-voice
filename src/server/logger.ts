/** Minimal structured (JSON lines) logger for server code. */
export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveLevel(raw: string | undefined): LogLevel {
  return raw && raw in ORDER ? (raw as LogLevel) : "info";
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export function createLogger(scope: string, level: LogLevel = resolveLevel(process.env.LOG_LEVEL)): Logger {
  const threshold = ORDER[level];
  const write = (lvl: LogLevel, message: string, fields?: Record<string, unknown>) => {
    if (ORDER[lvl] < threshold) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level: lvl, scope, message, ...fields });
    if (lvl === "error") console.error(line);
    else if (lvl === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    debug: (m, f) => write("debug", m, f),
    info: (m, f) => write("info", m, f),
    warn: (m, f) => write("warn", m, f),
    error: (m, f) => write("error", m, f),
  };
}

/** Render an unknown error for logs without leaking secrets (stack trimmed). */
export function errorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { errorName: err.name, errorMessage: err.message, stack: err.stack?.split("\n").slice(0, 4).join(" | ") };
  }
  return { errorMessage: String(err) };
}
