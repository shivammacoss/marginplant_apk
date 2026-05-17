import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { Input } from "@shared/ui/Input";
import { GradientButton } from "@shared/ui/GradientButton";
import { colors, radii, spacing } from "@shared/theme";
import { useUiStore } from "@shared/store/ui.store";
import { env } from "@core/config/env";
import {
  useCompanyBanks,
  useDeposit,
  useUploadScreenshot,
} from "@features/wallet/hooks/useWallet";
import {
  pickAndCompressImage,
  type PickedImage,
} from "@shared/utils/imagePicker";
import { UpiQrPanel } from "@features/wallet/components/UpiQrPanel";
import type { CompanyBank } from "@features/wallet/types/wallet.types";
import {
  buildMailtoUrl,
  buildWhatsappUrl,
  useSupportContacts,
} from "@features/support/useSupport";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000, 25000];
const PAYMENT_MODES = ["UPI", "NEFT", "RTGS", "IMPS", "BANK_TRANSFER"] as const;

export default function DepositScreen() {
  const pushToast = useUiStore((s) => s.pushToast);

  // Form state — field names match the web's `dep` exactly so the backend
  // contract is identical: amount / payment_mode / utr_number / screenshot_url
  // / user_remark / bank_account_id.
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<string>("UPI");
  const [utrNumber, setUtrNumber] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [userRemark, setUserRemark] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [localPreview, setLocalPreview] = useState<PickedImage | null>(null);

  const banks = useCompanyBanks();
  const upload = useUploadScreenshot();
  const deposit = useDeposit();

  const selectedBank = useMemo(
    () => banks.data?.find((b) => b.id === bankAccountId) ?? banks.data?.[0],
    [banks.data, bankAccountId],
  );

  // Auto-scroll plumbing — capture each section's y-position via onLayout
  // then use the ScrollView ref to glide the next section into view as
  // the user completes each step. Without this the user had to manually
  // scroll between Pay-using → Amount → UTR → Screenshot every time.
  const scrollRef = useRef<ScrollView>(null);
  const yAmount = useRef(0);
  const yUtr = useRef(0);
  const yScreenshot = useRef(0);
  const ySubmit = useRef(0);
  const capture = (ref: React.MutableRefObject<number>) =>
    (e: LayoutChangeEvent) => {
      ref.current = e.nativeEvent.layout.y;
    };
  const scrollTo = (y: number) => {
    // Small offset keeps the section header just above the field, not
    // glued to the top edge of the screen.
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  };

  // Auto-pick default (or first) bank once banks land.
  useEffect(() => {
    if (!bankAccountId && banks.data?.length) {
      const def = banks.data.find((b) => b.is_default) ?? banks.data[0];
      if (def) setBankAccountId(def.id);
    }
  }, [banks.data, bankAccountId]);

  // Step-complete triggers — fire scrollTo only on the transition (not on
  // every keystroke) so the page doesn't yank under the user mid-edit.
  // A bank pick is the only Step-1 completion event; once that's done
  // and the amount is still blank, jump down to the Amount field.
  const prevBankRef = useRef("");
  useEffect(() => {
    if (bankAccountId && !prevBankRef.current && yAmount.current > 0) {
      // Slight delay so the bank-row tap animation finishes first.
      setTimeout(() => scrollTo(yAmount.current), 220);
    }
    prevBankRef.current = bankAccountId;
  }, [bankAccountId]);

  async function onPickScreenshot() {
    try {
      const picked = await pickAndCompressImage();
      if (!picked) return;
      setLocalPreview(picked);
      const res = await upload.mutateAsync({
        uri: picked.uri,
        name: picked.name,
        type: picked.type,
      });
      setScreenshotUrl(res.url);
      pushToast({
        kind: "success",
        message: `Screenshot uploaded (${Math.round(picked.size / 1024)} KB)`,
      });
      // Last required step is done — glide down to the Submit button so
      // the user can tap without scrolling.
      setTimeout(() => scrollTo(ySubmit.current), 200);
    } catch {
      // upload hook already surfaces toast on error
    }
  }

  async function copy(value: string, label: string) {
    await Clipboard.setStringAsync(value);
    pushToast({ kind: "info", message: `${label} copied` });
  }

  async function submit() {
    const n = Number(amount);
    if (!n || n <= 0) {
      pushToast({ kind: "error", message: "Amount required" });
      return;
    }
    if (!bankAccountId) {
      pushToast({ kind: "error", message: "Pick a payment method" });
      return;
    }
    // UTR is now OPTIONAL — the user wants users to be able to submit
    // the deposit request without it (often the user pays first, then
    // copies the UTR from their bank app later). The admin approval
    // step still requires evidence (screenshot recommended), so the
    // approval workflow catches missing-UTR cases.
    try {
      await deposit.mutateAsync({
        amount: n,
        payment_mode: paymentMode,
        utr_number: utrNumber.trim() || undefined,
        screenshot_url: screenshotUrl || undefined,
        user_remark: userRemark || undefined,
        bank_account_id: bankAccountId,
      });
      pushToast({
        kind: "success",
        message: "Deposit submitted — awaiting admin approval",
      });
      router.back();
    } catch {
      // hook surfaces the error toast
    }
  }

  const submitting = deposit.isPending;
  const uploading = upload.isPending;

  // ── Support contacts ─────────────────────────────────────────────
  // Admin-managed via /admin/settings/platform. The deposit page is a
  // common place where users get stuck (UTR copy issues, screenshot
  // size, bank-mismatch); surfacing a "Chat support" pill at the top
  // means they can reach out without abandoning the form.
  const { data: support } = useSupportContacts();
  const depositWaUrl = buildWhatsappUrl(
    support?.whatsapp,
    "Hi, I need help adding funds to my MarginPlant account",
  );
  const depositMailUrl = buildMailtoUrl(support?.email, {
    subject: "MarginPlant deposit help",
  });

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header
          title="Add funds"
          back
          right={
            depositWaUrl || depositMailUrl ? (
              <Pressable
                onPress={() => {
                  const url = depositWaUrl ?? depositMailUrl!;
                  void Linking.openURL(url);
                }}
                hitSlop={8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bgElevated,
                }}
              >
                <Ionicons
                  name={depositWaUrl ? "logo-whatsapp" : "mail-outline"}
                  size={13}
                  color={depositWaUrl ? "#25D366" : colors.primary}
                />
                <Text size="xs" style={{ fontWeight: "700" }}>
                  Support
                </Text>
              </Pressable>
            ) : undefined
          }
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing["5xl"] * 2,
            gap: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        {/* Step 1 — Pay using */}
        <StepLabel num={1} title="Pay using" />

        {banks.isLoading ? (
          <View style={{ paddingVertical: spacing.lg, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (banks.data?.length ?? 0) === 0 ? (
          <EmptyHint message="No payment methods configured yet." />
        ) : (
          <View style={{ gap: 8 }}>
            {banks.data!.map((b) => (
              <BankOption
                key={b.id}
                bank={b}
                active={b.id === bankAccountId}
                onPress={() => setBankAccountId(b.id)}
              />
            ))}
          </View>
        )}

        {selectedBank ? (
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              gap: 10,
            }}
          >
            <CopyRow label="A/C No." value={selectedBank.account_number} onCopy={copy} />
            <CopyRow label="IFSC" value={selectedBank.ifsc_code} onCopy={copy} />
            <CopyRow label="Holder" value={selectedBank.account_holder} onCopy={copy} />
            {selectedBank.upi_id ? (
              <CopyRow
                label="UPI ID"
                value={selectedBank.upi_id}
                onCopy={copy}
                highlight
              />
            ) : null}
          </View>
        ) : null}

        {selectedBank && (selectedBank.qr_code_url || selectedBank.upi_id) ? (
          <UpiQrPanel
            upiId={selectedBank.upi_id ?? null}
            payeeName={selectedBank.account_holder}
            qrCodeUrl={selectedBank.qr_code_url ?? null}
            amount={Number(amount) > 0 ? Number(amount) : undefined}
          />
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: colors.bgElevated,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
          }}
        >
          <UpiLogo size={36} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600" }}>UPI accepted</Text>
            <Text tone="muted" size="xs" style={{ marginTop: 2 }}>
              GPay · PhonePe · Paytm · BHIM · any UPI bank app
            </Text>
          </View>
        </View>

        {/* Step 2 — Confirm your payment */}
        <View
          style={{ marginTop: spacing.md }}
          onLayout={capture(yAmount)}
        >
          <StepLabel num={2} title="Confirm your payment" />
        </View>

        <Input
          label="Amount (₹)"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ""))}
          placeholder="500"
        />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {QUICK_AMOUNTS.map((v) => (
            <QuickPill
              key={v}
              label={`+₹${v.toLocaleString("en-IN")}`}
              onPress={() => {
                setAmount(String(v));
                // Quick-pill tap = user has decided on an amount. Glide
                // straight to the UTR field so they can paste their txn
                // reference without scrolling.
                setTimeout(() => scrollTo(yUtr.current), 180);
              }}
            />
          ))}
        </View>

        <View style={{ gap: 6 }}>
          <Text tone="muted" size="sm" style={{ marginLeft: 4 }}>
            Payment mode
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PAYMENT_MODES.map((m) => (
              <ModeChip
                key={m}
                label={m}
                active={paymentMode === m}
                onPress={() => setPaymentMode(m)}
              />
            ))}
          </View>
        </View>

        <View onLayout={capture(yUtr)}>
          <Input
            label="UTR / Transaction reference (optional)"
            value={utrNumber}
            onChangeText={setUtrNumber}
            placeholder="From your bank / UPI app receipt"
            autoCapitalize="characters"
            onBlur={() => {
              // User finished typing UTR (focus left the field) — bring
              // the Screenshot dropzone into view so they don't have to
              // scroll to find the next step.
              if (utrNumber.trim().length >= 6 && !screenshotUrl) {
                setTimeout(() => scrollTo(yScreenshot.current), 120);
              }
            }}
          />
        </View>

        <View style={{ gap: 6 }} onLayout={capture(yScreenshot)}>
          <Text tone="muted" size="sm" style={{ marginLeft: 4 }}>
            Payment screenshot
          </Text>
          {screenshotUrl ? (
            <UploadedPreview
              uri={
                localPreview?.uri ??
                (screenshotUrl.startsWith("http")
                  ? screenshotUrl
                  : `${env.API_URL}${screenshotUrl}`)
              }
              onRemove={() => {
                setScreenshotUrl("");
                setLocalPreview(null);
              }}
            />
          ) : (
            <UploadDropzone
              uploading={uploading}
              onPress={onPickScreenshot}
              compressedHint={
                localPreview
                  ? `Compressed to ${Math.round(localPreview.size / 1024)} KB`
                  : undefined
              }
            />
          )}
        </View>

        <Input
          label="Remarks (optional)"
          value={userRemark}
          onChangeText={setUserRemark}
          placeholder="Add a note for the admin"
        />

        <View
          style={{ marginTop: spacing.md }}
          onLayout={capture(ySubmit)}
        >
          <GradientButton
            label="Submit for approval"
            loading={submitting}
            disabled={submitting || uploading}
            onPress={submit}
          />
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function StepLabel({ num, title }: { num: number; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
          {num}
        </Text>
      </View>
      <Text
        tone="muted"
        size="xs"
        style={{ fontWeight: "700", letterSpacing: 0.8 }}
      >
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

function BankOption({
  bank,
  active,
  onPress,
}: {
  bank: CompanyBank;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: radii.lg,
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? "rgba(168,85,247,0.08)" : colors.bgElevated,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "rgba(168,85,247,0.18)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="business-outline" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
          {bank.bank_name}
        </Text>
        <Text tone="muted" size="xs" numberOfLines={1}>
          {bank.account_holder}
        </Text>
      </View>
      {bank.is_default ? (
        <View
          style={{
            backgroundColor: "rgba(168,85,247,0.25)",
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 9,
              fontWeight: "700",
              letterSpacing: 0.5,
            }}
          >
            DEFAULT
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  highlight,
}: {
  label: string;
  value: string;
  onCopy: (value: string, label: string) => void;
  highlight?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Text tone="muted" size="xs">
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text
          mono
          style={{
            color: highlight ? colors.primary : colors.text,
            fontSize: 13,
            fontWeight: highlight ? "700" : "500",
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
        <Pressable onPress={() => onCopy(value, label)} hitSlop={8}>
          <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function QuickPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgElevated,
        }}
      >
        <Text size="xs" style={{ fontWeight: "600" }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function ModeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? "rgba(168,85,247,0.15)" : colors.bgElevated,
      }}
    >
      <Text
        size="xs"
        style={{
          fontWeight: "600",
          color: active ? colors.primary : colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function UploadDropzone({
  uploading,
  onPress,
  compressedHint,
}: {
  uploading: boolean;
  onPress: () => void;
  compressedHint?: string;
}) {
  return (
    <Pressable
      disabled={uploading}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: colors.border,
        borderRadius: radii.lg,
        backgroundColor: colors.bgElevated,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.md,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: uploading ? 0.6 : 1,
      }}
    >
      {uploading ? (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text tone="muted" size="sm">
            Compressing & uploading…
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="cloud-upload-outline" size={26} color={colors.textMuted} />
          <Text tone="muted" size="sm">
            Tap to upload screenshot
          </Text>
          <Text tone="dim" size="xs">
            {compressedHint ?? "We compress large screenshots before upload"}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function UploadedPreview({
  uri,
  onRemove,
}: {
  uri: string;
  onRemove: () => void;
}) {
  return (
    <View
      style={{
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
        padding: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Image
        source={{ uri }}
        style={{
          width: 60,
          height: 60,
          borderRadius: 8,
          backgroundColor: colors.bgSurface,
        }}
        resizeMode="cover"
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "500" }}>Screenshot ready</Text>
        <Text tone="dim" size="xs">
          Will be attached on submit
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        style={{
          padding: 6,
          borderRadius: 999,
          backgroundColor: "rgba(251,113,133,0.15)",
        }}
      >
        <Ionicons name="close" size={14} color={colors.sell} />
      </Pressable>
    </View>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: colors.border,
        borderRadius: radii.lg,
        padding: spacing.md,
      }}
    >
      <Text tone="muted" size="sm">
        {message}
      </Text>
    </View>
  );
}

function UpiLogo({ size = 36 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#0f3470",
          fontSize: size * 0.34,
          fontWeight: "900",
          letterSpacing: 1,
        }}
      >
        UPI
      </Text>
    </View>
  );
}
