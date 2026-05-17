import { format, isWithinInterval, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const IST = "Asia/Kolkata";

export function nowUTC(): Date {
  return new Date();
}

export function toIST(d: Date | string): Date {
  const date = typeof d === "string" ? parseISO(d) : d;
  return toZonedTime(date, IST);
}

export function fmtIST(d: Date | string, pattern = "dd MMM yyyy, hh:mm a"): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return formatInTimeZone(date, IST, pattern);
}

export function fmtTime(d: Date | string): string {
  return fmtIST(d, "hh:mm:ss a");
}

export function fmtDate(d: Date | string): string {
  return fmtIST(d, "dd MMM yyyy");
}

export function isMarketHoursIST(d: Date = nowUTC()): boolean {
  const ist = toIST(d);
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const open = new Date(ist);
  open.setHours(9, 15, 0, 0);
  const close = new Date(ist);
  close.setHours(15, 30, 0, 0);
  return isWithinInterval(ist, { start: open, end: close });
}

export { format };
