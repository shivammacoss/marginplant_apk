import { useState } from "react";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { env } from "@core/config/env";
import { getAccessToken } from "@core/api/tokens";
import { useUiStore } from "@shared/store/ui.store";

export type ReportKind = "pnl" | "tradebook" | "brokerage" | "tax" | "margin";

const LABEL: Record<ReportKind, string> = {
  pnl: "P&L statement",
  tradebook: "Tradebook",
  brokerage: "Brokerage summary",
  tax: "Tax P&L",
  margin: "Margin report",
};

function buildUrl(kind: ReportKind, params?: Record<string, string | number | undefined>): string {
  const url = `${env.API_URL}/api/v1/user/reports/${kind}/pdf`;
  if (!params) return url;
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${url}?${qs}` : url;
}

/**
 * Download a report PDF and open the system share sheet so the user can save
 * it to Drive / WhatsApp / email / files. We hit the backend `/reports/{kind}/pdf`
 * route with the same access token the rest of the app uses (no separate
 * download URL signing — reuses the JWT).
 *
 * Why share-sheet and not "save to downloads"? Android scoped storage in API
 * 33+ blocks direct writes to /Downloads from the app sandbox without
 * MANAGE_EXTERNAL_STORAGE. The share sheet lets the user pick *where* to
 * save (Drive, Files, Keep, etc.) without that permission, which mirrors
 * how Zerodha / Groww apps handle report exports.
 */
export function useDownloadReportPdf() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [downloading, setDownloading] = useState<ReportKind | null>(null);

  async function download(
    kind: ReportKind,
    params?: Record<string, string | number | undefined>,
  ): Promise<void> {
    if (downloading) return; // single-flight
    setDownloading(kind);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `marginplant_${kind}_${stamp}.pdf`;
    const target = `${FileSystem.cacheDirectory}${filename}`;
    const token = getAccessToken();
    try {
      const res = await FileSystem.downloadAsync(buildUrl(kind, params), target, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status !== 200) {
        // Best-effort: try to read body for a clue, otherwise just report status.
        let message = `Download failed (HTTP ${res.status})`;
        try {
          const txt = await FileSystem.readAsStringAsync(res.uri);
          if (txt && txt.length < 400) message = txt;
        } catch {
          // ignore
        }
        await FileSystem.deleteAsync(res.uri, { idempotent: true }).catch(() => null);
        throw new Error(message);
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(res.uri, {
          mimeType: "application/pdf",
          dialogTitle: `Save ${LABEL[kind]}`,
          UTI: "com.adobe.pdf",
        });
        pushToast({ kind: "success", message: `${LABEL[kind]} ready to save` });
      } else {
        // Web/iOS-simulator path: tell the user where the file went.
        pushToast({
          kind: "info",
          message:
            Platform.OS === "web"
              ? "PDF downloaded"
              : `Saved to ${filename}`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't download PDF";
      pushToast({ kind: "error", message: msg });
    } finally {
      setDownloading(null);
    }
  }

  return { download, downloading };
}
