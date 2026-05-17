import { memo, useMemo, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { env } from "@core/config/env";

interface Props {
  upiId?: string | null;
  payeeName?: string;
  qrCodeUrl?: string | null;
  amount?: number;
}

// UPI deep-link format — matches the web's buildUpiUri exactly so any
// scanner that works on the web checkout works here too. Spec: NPCI UPI
// linking spec / EBPP. cu=INR is required by most banking apps.
export function buildUpiUri(opts: {
  upiId: string;
  payeeName?: string;
  amount?: number;
  note?: string;
}): string {
  const params: string[] = [`pa=${encodeURIComponent(opts.upiId.trim())}`];
  if (opts.payeeName) params.push(`pn=${encodeURIComponent(opts.payeeName)}`);
  if (opts.amount && opts.amount > 0)
    params.push(`am=${opts.amount.toFixed(2)}`);
  if (opts.note) params.push(`tn=${encodeURIComponent(opts.note)}`);
  params.push("cu=INR");
  return `upi://pay?${params.join("&")}`;
}

// We use api.qrserver.com to render the QR — keeps the bundle dep-free.
// Image is cached by the OS once fetched. Falls back to the admin-uploaded
// `qr_code_url` first when present (admin static QR).
function qrServerUri(text: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&qzone=1&margin=0&color=000000&bgcolor=ffffff&data=${encodeURIComponent(text)}`;
}

function resolveQrUrl(qrCodeUrl?: string | null): string | null {
  if (!qrCodeUrl) return null;
  if (qrCodeUrl.startsWith("http")) return qrCodeUrl;
  return `${env.API_URL}${qrCodeUrl}`;
}

function UpiQrPanelImpl({ upiId, payeeName, qrCodeUrl, amount }: Props) {
  // Start COLLAPSED so the QR `<Image>` never gets the URL until the user
  // taps "View QR". Reasons:
  //   • The qrserver.com round-trip + decode adds ~300-600 ms to the
  //     deposit page load — most users use the A/C number copy buttons
  //     above and never need the QR, so paying that cost up front is
  //     wasted bandwidth.
  //   • Amount-driven QR rebuilds when the user types in the amount
  //     field used to fetch a fresh image on every keystroke; now they
  //     only happen after the user has explicitly opened the panel.
  const [collapsed, setCollapsed] = useState(true);

  const uri = useMemo(() => {
    // Only compute (and re-fetch) the QR source AFTER the panel has been
    // expanded at least once. Saves the initial network call on first
    // page paint.
    if (collapsed) return null;
    if (qrCodeUrl) return resolveQrUrl(qrCodeUrl);
    if (upiId && upiId.trim()) {
      return qrServerUri(buildUpiUri({ upiId, payeeName, amount }), 280);
    }
    return null;
  }, [collapsed, upiId, payeeName, qrCodeUrl, amount]);

  // Are we capable of producing a QR at all? (separate from "is the panel
  // currently expanded"). Only when both upiId and qrCodeUrl are missing
  // do we show the "not configured" placeholder.
  const hasSource = !!qrCodeUrl || !!(upiId && upiId.trim());

  if (!hasSource) {
    return (
      <View
        style={{
          padding: spacing.md,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: colors.border,
          alignItems: "center",
          gap: 4,
        }}
      >
        <Ionicons name="qr-code-outline" size={22} color={colors.textDim} />
        <Text tone="muted" size="sm">
          QR not configured for this method
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
        overflow: "hidden",
      }}
    >
      {/* Header — tappable to collapse/expand */}
      <Pressable
        onPress={() => setCollapsed((v) => !v)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          borderBottomWidth: collapsed ? 0 : 1,
          borderBottomColor: colors.border,
        }}
      >
        <Ionicons name="qr-code-outline" size={16} color={colors.primary} />
        <Text style={{ flex: 1, marginLeft: 8, fontWeight: "700" }}>
          {collapsed ? "Tap to view QR" : "Scan & Pay"}
        </Text>
        {upiId ? (
          <Text mono size="xs" tone="muted" style={{ marginRight: 6 }}>
            {upiId}
          </Text>
        ) : null}
        <Ionicons
          name={collapsed ? "chevron-down" : "chevron-up"}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>

      {!collapsed ? (
        <View style={{ alignItems: "center", paddingVertical: spacing.md, gap: 8 }}>
          <View
            style={{
              backgroundColor: "#fff",
              padding: 10,
              borderRadius: 8,
            }}
          >
            <Image
              source={{ uri: uri ?? undefined }}
              style={{ width: 220, height: 220 }}
              resizeMode="contain"
            />
          </View>
          <Text tone="muted" size="xs" style={{ textAlign: "center", paddingHorizontal: spacing.md }}>
            Open any UPI app (GPay, PhonePe, Paytm, BHIM) and scan
            {amount && amount > 0 ? ` — ₹${amount.toFixed(2)} pre-filled` : ""}.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const UpiQrPanel = memo(UpiQrPanelImpl);
