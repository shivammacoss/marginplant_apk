import type { AxiosError } from "axios";
import type { ApiErrorResponse, ApiResponse } from "@core/types/api";

export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  status?: number;

  constructor(message: string, code: string, details?: Record<string, unknown>, status?: number) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = status;
    this.name = "ApiError";
  }
}

// Turn the generic "An unexpected error occurred" 500 messages into something
// actionable. The backend's `_unhandled_handler` swallows every uncaught
// exception with that fixed string — without this normalisation the user
// has no hint as to whether it's a server bug, a network glitch, or their
// session expiring. We append the HTTP status / endpoint path so the toast
// is at least debuggable in the wild.
// Pull the first field-specific message out of FastAPI's RequestValidation
// payload — the backend's _validation_handler returns the generic
// "Request validation failed" string and stuffs the real per-field reasons
// inside `details.errors[].msg`. Without this the user just sees the
// generic message and has no idea what to fix (e.g. our register form was
// silently failing because the backend requires uppercase+lowercase+digit
// in passwords).
function extractValidationDetail(
  details: Record<string, unknown> | undefined,
): string | null {
  if (!details) return null;
  const errors = (details as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const first = errors[0] as { msg?: string; loc?: unknown[] };
  if (typeof first.msg !== "string" || first.msg.length === 0) return null;
  // Pydantic v2 prefixes msg with "Value error, ..." — strip it.
  return first.msg.replace(/^Value error,\s*/i, "");
}

function normaliseMessage(
  message: string,
  code: string,
  status: number | undefined,
  url: string | undefined,
  details: Record<string, unknown> | undefined,
): string {
  // Friendly mapping for common cases.
  if (status === 401 || status === 403) {
    return "Session expired — please log in again.";
  }
  if (status === 503 || status === 502 || status === 504) {
    return "Server unreachable — check your internet and try again.";
  }
  if (status === 429) {
    return "Too many attempts — slow down and retry.";
  }
  if (status === 422 || code === "VALIDATION_FAILED") {
    const detail = extractValidationDetail(details);
    if (detail) return detail;
    return message || "Please check the fields and try again.";
  }
  if (status === 500 || code === "INTERNAL_SERVER_ERROR") {
    // Backend logs the full traceback under `logger.exception("unhandled_exception")`
    // — surface a short, debuggable suffix so the user can quote it in support.
    const path = url ? url.split("?")[0]?.split("/").slice(-2).join("/") ?? "" : "";
    return path
      ? `Server error on ${path}. Please try again or contact support.`
      : "Server error — please try again or contact support.";
  }
  return message;
}

export async function unwrap<T>(p: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await p;
    if (!res.data?.success || res.data.data == null) {
      throw new ApiError(res.data?.message || "Unknown error", "UNKNOWN");
    }
    return res.data.data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const ax = err as AxiosError<ApiErrorResponse>;
    const e = ax.response?.data?.error;
    const status = ax.response?.status;
    const url = ax.config?.url;
    const code = e?.code || "NETWORK";
    const rawMessage = e?.message || ax.message || "Network error";
    throw new ApiError(
      normaliseMessage(rawMessage, code, status, url, e?.details),
      code,
      e?.details,
      status,
    );
  }
}
