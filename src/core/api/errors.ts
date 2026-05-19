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

// CODE → friendly message table. Every backend AppError ships a `code`
// (see backend/app/core/exceptions.py + the trading domain raises in
// services/order_validator.py & risk_enforcer.py). Mapping by CODE
// first means we get the same wording whether the same error comes
// back as 400, 403 or 422 — and we no longer collapse "admin blocked
// this segment" / "stop-loss is mandatory" into the generic
// "Session expired" 401-403 fallback (the bug the user repeatedly
// reported). When a code isn't listed here we fall through to the
// backend's `message` string, which is already user-friendly for
// every raise site in the codebase.
const CODE_MESSAGES: Record<string, string> = {
  // ── Auth ─────────────────────────────────────────────────────────
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_BLOCKED: "Account blocked — contact support.",
  ACCOUNT_INACTIVE: "Account is not active — contact support.",
  TWO_FA_REQUIRED: "Two-factor code required.",
  TWO_FA_INVALID: "Two-factor code is incorrect.",
  // Token issues — these legitimately mean "log in again".
  TOKEN_EXPIRED: "Session expired — please log in again.",
  TOKEN_INVALID: "Session is invalid — please log in again.",
  AUTH_ERROR: "Authentication failed — please log in again.",

  // ── Permissions ──────────────────────────────────────────────────
  FORBIDDEN: "You don't have permission for this action.",
  PERMISSION_DENIED: "Trading is disabled on your account — contact support.",

  // ── Trading (segment + lots + risk gates) ────────────────────────
  SEGMENT_NOT_ALLOWED: "This segment is blocked by admin.",
  MARKET_CLOSED: "Market is closed for this instrument.",
  EXIT_ONLY_MODE: "Exit-only mode is on — only closing trades allowed.",
  INSUFFICIENT_FUNDS: "Insufficient balance — add funds to place this trade.",
  HOLD_TIME_GUARD: "Hold-time guard active — wait before closing this trade.",

  // ── Resource ─────────────────────────────────────────────────────
  NOT_FOUND: "Not found.",
  CONFLICT: "Already exists.",
  RATE_LIMIT_EXCEEDED: "Too many attempts — slow down and retry.",
};

// Codes that genuinely mean "your auth is bust, send to login screen".
// Listed separately so caller-side hooks (e.g. session-expired redirect)
// can detect them via `error.code in SESSION_BUST_CODES`.
const SESSION_BUST_CODES = new Set(["TOKEN_EXPIRED", "TOKEN_INVALID", "AUTH_ERROR"]);

function normaliseMessage(
  message: string,
  code: string,
  status: number | undefined,
  url: string | undefined,
  details: Record<string, unknown> | undefined,
): string {
  // 1. Code-first mapping. Wins over status because the same code may
  //    arrive with different statuses depending on call site.
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }

  // 2. Validation — extract the first per-field reason from the
  //    backend's Pydantic error payload. Falls back to the raw
  //    "Validation failed" message if no field detail is present.
  if (status === 422 || code === "VALIDATION_FAILED") {
    const detail = extractValidationDetail(details);
    if (detail) return detail;
    return message || "Please check the fields and try again.";
  }

  // 3. Infra-level statuses — these come from gateways / load
  //    balancers, not our backend code, so `message` is rarely
  //    useful. Show a short actionable line instead.
  if (status === 503 || status === 502 || status === 504) {
    return "Server unreachable — check your internet and try again.";
  }
  if (status === 429) {
    return CODE_MESSAGES.RATE_LIMIT_EXCEEDED;
  }

  // 4. 500 — backend's _unhandled_handler swallows real tracebacks
  //    with a generic "An unexpected error occurred". Suffix the path
  //    so the user can quote it in support.
  if (status === 500 || code === "INTERNAL_SERVER_ERROR") {
    const path = url ? url.split("?")[0]?.split("/").slice(-2).join("/") ?? "" : "";
    return path
      ? `Server error on ${path}. Please try again or contact support.`
      : "Server error — please try again or contact support.";
  }

  // 5. 401/403 with NO recognised code → likely a token issue or a
  //    forgotten backend raise — default to "Session expired" so the
  //    user knows logging in again is the next step. Specific 401/403
  //    cases (INVALID_CREDENTIALS, SEGMENT_NOT_ALLOWED, etc.) already
  //    matched step 1 above.
  if (status === 401 || status === 403) {
    if (message && !/(unauthorized|forbidden|not\s*authenticated)/i.test(message)) {
      // Backend raised something domain-specific without a code we know —
      // its `message` is more useful than the generic fallback.
      return message;
    }
    return "Session expired — please log in again.";
  }

  // 6. Default — backend's message string. Every raise site in the
  //    codebase ships a human-readable line so this is almost always
  //    the right thing to show.
  return message || "Something went wrong.";
}

/** True when the error code means the user's session is actually
 *  invalid (token expired/invalid). Use this to decide whether to
 *  kick the user to the login screen vs just show a toast. */
export function isSessionBust(err: unknown): boolean {
  return err instanceof ApiError && SESSION_BUST_CODES.has(err.code);
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
