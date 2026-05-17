import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { Input } from "@shared/ui/Input";
import { GradientButton } from "@shared/ui/GradientButton";
import { colors, radii, spacing } from "@shared/theme";
import { useUiStore } from "@shared/store/ui.store";
import { formatINR } from "@shared/utils/format";
import {
  useMyBankAccounts,
  useWalletSummary,
  useWithdraw,
} from "@features/wallet/hooks/useWallet";
import { useAuthStore } from "@features/auth/store/auth.store";
import type { UserBank } from "@features/wallet/types/wallet.types";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000, 25000];

// Light UPI ID validator — `user@handle` where handle is at least 2 alphanum
// chars. Catches the typical typos (missing @, trailing spaces) without
// false-rejecting valid VPAs like `9876543210@paytm`.
const UPI_RE = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;

type Mode = "bank" | "upi";

export default function WithdrawScreen() {
  const pushToast = useUiStore((s) => s.pushToast);
  const banks = useMyBankAccounts();
  const summary = useWalletSummary();
  const withdraw = useWithdraw();
  const user = useAuthStore((s) => s.user);

  const [mode, setMode] = useState<Mode>("bank");
  const [amount, setAmount] = useState("");
  const [bankId, setBankId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiHolder, setUpiHolder] = useState(user?.full_name ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selected = useMemo(
    () => banks.data?.find((b) => b.id === bankId),
    [banks.data, bankId],
  );

  useEffect(() => {
    if (mode === "bank" && !bankId && banks.data?.length) {
      const def = banks.data.find((b) => b.is_default) ?? banks.data[0];
      if (def) setBankId(def.id);
    }
  }, [banks.data, bankId, mode]);

  useEffect(() => {
    if (!upiHolder && user?.full_name) setUpiHolder(user.full_name);
  }, [user?.full_name, upiHolder]);

  async function submit() {
    const errs: Record<string, string> = {};
    const n = Number(amount);
    if (!n || n <= 0) {
      pushToast({ kind: "error", message: "Amount required" });
      return;
    }

    if (mode === "bank") {
      if (!selected) {
        pushToast({ kind: "error", message: "Select a bank account" });
        return;
      }
    } else {
      // UPI mode validation
      if (!upiId.trim() || !UPI_RE.test(upiId.trim())) {
        errs.upi_id = "Enter a valid UPI ID (e.g. name@paytm)";
      }
      if (!upiHolder.trim()) {
        errs.upi_holder = "Holder name required";
      }
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
    }
    setErrors({});

    const avail = Number(summary.data?.available_balance ?? 0);
    if (avail > 0 && n > avail) {
      pushToast({
        kind: "warn",
        message: `Available balance ${formatINR(avail)} — admin may reject larger requests`,
      });
    }

    try {
      // Backend WithdrawalCreate contract: `bank` is a dict mapped server-side
      // to BankSnapshot{name, account_number, ifsc, holder, branch?,
      // account_type?}. We reuse those slots for UPI so no backend schema
      // change is needed and admin sees a clear "UPI · <vpa>" snapshot:
      //   bank.name           = "UPI · <vpa>" (admin-readable label)
      //   bank.account_number = the UPI VPA itself (so admin can copy/paste)
      //   bank.ifsc           = "UPI"   (sentinel — distinguishes from bank)
      //   bank.holder         = holder name (user.full_name by default)
      //   bank.account_type   = "UPI"
      const bankPayload =
        mode === "bank"
          ? {
              name: selected!.bank_name,
              account_number: selected!.account_number,
              ifsc: selected!.ifsc_code,
              holder: selected!.account_holder,
            }
          : {
              name: `UPI · ${upiId.trim()}`,
              account_number: upiId.trim(),
              ifsc: "UPI",
              holder: upiHolder.trim(),
              account_type: "UPI",
            };

      await withdraw.mutateAsync({
        amount: n,
        remarks: remarks || undefined,
        bank: bankPayload,
      });
      pushToast({
        kind: "success",
        message: "Withdrawal requested — awaiting admin approval",
      });
      router.back();
    } catch {
      // hook surfaces error toast
    }
  }

  const submitting = withdraw.isPending;
  const canSubmit =
    mode === "bank" ? !!selected : !!upiId.trim() && !!upiHolder.trim();

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header title="Withdraw funds" back />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing["5xl"] * 2,
            gap: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              gap: 6,
            }}
          >
            <Text tone="muted" size="xs" style={{ letterSpacing: 0.5 }}>
              AVAILABLE TO WITHDRAW
            </Text>
            <Text mono style={{ fontSize: 24, fontWeight: "700" }}>
              {formatINR(summary.data?.available_balance ?? 0)}
            </Text>
            <Text tone="dim" size="xs">
              Money goes to your chosen payout method. Admin approves before
              payout.
            </Text>
          </View>

          <Input
            label="Amount (₹)"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ""))}
            placeholder="0"
          />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {QUICK_AMOUNTS.map((v) => (
              <Pressable key={v} onPress={() => setAmount(String(v))}>
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
                    ₹{v.toLocaleString("en-IN")}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Mode toggle: Bank | UPI */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.bgElevated,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 4,
              marginTop: spacing.sm,
            }}
          >
            <ModePill
              icon="card-outline"
              label="Bank"
              active={mode === "bank"}
              onPress={() => setMode("bank")}
            />
            <ModePill
              icon="phone-portrait-outline"
              label="UPI ID"
              active={mode === "upi"}
              onPress={() => setMode("upi")}
            />
          </View>

          {mode === "bank" ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 4,
                }}
              >
                <Text tone="muted" size="sm" style={{ marginLeft: 4 }}>
                  Bank account
                </Text>
                <Pressable
                  onPress={() => router.push("/wallet/add-bank")}
                  hitSlop={6}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={14}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    Add new
                  </Text>
                </Pressable>
              </View>

              {banks.isLoading ? (
                <View
                  style={{ paddingVertical: spacing.lg, alignItems: "center" }}
                >
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (banks.data?.length ?? 0) === 0 ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: colors.border,
                    borderRadius: radii.lg,
                    padding: spacing.md,
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons
                    name="card-outline"
                    size={26}
                    color={colors.textMuted}
                  />
                  <Text tone="muted" size="sm" style={{ textAlign: "center" }}>
                    No bank accounts linked yet
                  </Text>
                  <Pressable
                    onPress={() => router.push("/wallet/add-bank")}
                    hitSlop={8}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      + Add a bank account
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {banks.data!.map((b) => (
                    <BankRow
                      key={b.id}
                      bank={b}
                      active={b.id === bankId}
                      onPress={() => setBankId(b.id)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={{ gap: spacing.md }}>
              <Input
                label="UPI ID"
                value={upiId}
                onChangeText={(v) => setUpiId(v.replace(/\s/g, ""))}
                placeholder="yourname@paytm"
                autoCapitalize="none"
                error={errors.upi_id}
                hint="e.g. 9876543210@paytm · name@oksbi · vpa@ybl"
              />
              <Input
                label="Account holder name"
                value={upiHolder}
                onChangeText={setUpiHolder}
                placeholder="As per UPI"
                autoCapitalize="words"
                error={errors.upi_holder}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bgElevated,
                }}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={colors.info}
                />
                <Text tone="muted" size="xs" style={{ flex: 1 }}>
                  Admin will transfer the approved amount to this UPI ID. Make
                  sure it's correct — refunds for typos can take days.
                </Text>
              </View>
            </View>
          )}

          <Input
            label="Remarks (optional)"
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Add a note for the admin"
          />

          <View style={{ marginTop: spacing.md }}>
            <GradientButton
              label={
                mode === "upi" ? "Request UPI withdrawal" : "Request withdrawal"
              }
              loading={submitting}
              disabled={submitting || !canSubmit}
              onPress={submit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ModePill({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: active ? colors.bgSurface : "transparent",
      }}
    >
      <Ionicons
        name={icon}
        size={14}
        color={active ? colors.text : colors.textMuted}
      />
      <Text
        size="sm"
        style={{
          color: active ? colors.text : colors.textMuted,
          fontWeight: active ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BankRow({
  bank,
  active,
  onPress,
}: {
  bank: UserBank;
  active: boolean;
  onPress: () => void;
}) {
  const last4 = String(bank.account_number).slice(-4);
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
        <Ionicons name="card-outline" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
          {bank.bank_name}
        </Text>
        <Text tone="muted" size="xs" numberOfLines={1}>
          {bank.account_holder} · •••• {last4}
        </Text>
      </View>
      {bank.is_verified ? (
        <Ionicons name="checkmark-circle" size={16} color={colors.buy} />
      ) : null}
    </Pressable>
  );
}
