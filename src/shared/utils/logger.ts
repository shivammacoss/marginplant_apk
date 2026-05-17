import { isDev } from "@core/config/env";

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, args: unknown[]): void {
  if (!isDev && level === "debug") return;
  const tag = `[${level.toUpperCase()}]`;
  if (level === "error") console.error(tag, ...args);
  else if (level === "warn") console.warn(tag, ...args);
  else console.log(tag, ...args);
}

export const log = {
  debug: (...a: unknown[]) => emit("debug", a),
  info: (...a: unknown[]) => emit("info", a),
  warn: (...a: unknown[]) => emit("warn", a),
  error: (...a: unknown[]) => emit("error", a),
};
