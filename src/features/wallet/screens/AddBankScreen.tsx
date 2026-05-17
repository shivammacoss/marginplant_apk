import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { router } from "expo-router";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Input } from "@shared/ui/Input";
import { GradientButton } from "@shared/ui/GradientButton";
import { Text } from "@shared/ui/Text";
import { Toggle } from "@shared/ui/Toggle";
import { colors, radii, spacing } from "@shared/theme";
import { useAddBankAccount } from "@features/wallet/hooks/useWallet";

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export default function AddBankScreen() {
  const add = useAddBankAccount();

  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [nickname, setNickname] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!bankName.trim()) e.bank_name = "Required";
    if (!accountHolder.trim()) e.account_holder = "Required";
    if (!accountNumber.trim() || accountNumber.replace(/\s/g, "").length < 6)
      e.account_number = "Enter a valid account number";
    const ifscUp = ifsc.trim().toUpperCase();
    if (!IFSC_RE.test(ifscUp)) e.ifsc_code = "Invalid IFSC";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    try {
      await add.mutateAsync({
        bank_name: bankName.trim(),
        account_holder: accountHolder.trim(),
        account_number: accountNumber.replace(/\s/g, ""),
        ifsc_code: ifsc.trim().toUpperCase(),
        nickname: nickname.trim() || undefined,
        is_default: isDefault,
      });
      router.back();
    } catch {
      // hook surfaces error
    }
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header title="Add bank account" back />
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
        <Text tone="muted" size="sm">
          We use this account for payouts when admin approves a withdrawal.
        </Text>

        <Input
          label="Bank name"
          value={bankName}
          onChangeText={setBankName}
          placeholder="e.g. HDFC Bank"
          error={errors.bank_name}
        />
        <Input
          label="Account holder name"
          value={accountHolder}
          onChangeText={setAccountHolder}
          placeholder="As per passbook"
          autoCapitalize="words"
          error={errors.account_holder}
        />
        <Input
          label="Account number"
          value={accountNumber}
          onChangeText={(v) => setAccountNumber(v.replace(/\s/g, ""))}
          placeholder="A/C number"
          keyboardType="number-pad"
          error={errors.account_number}
        />
        <Input
          label="IFSC code"
          value={ifsc}
          onChangeText={(v) => setIfsc(v.toUpperCase())}
          placeholder="e.g. HDFC0001234"
          autoCapitalize="characters"
          error={errors.ifsc_code}
          hint="11 chars, format: XXXX0XXXXXX"
        />
        <Input
          label="Nickname (optional)"
          value={nickname}
          onChangeText={setNickname}
          placeholder="Salary / Savings"
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.bgElevated,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 14,
            paddingHorizontal: 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "500", fontSize: 14 }}>
              Set as default
            </Text>
            <Text tone="muted" size="xs" style={{ marginTop: 2 }}>
              Pre-selected for future withdrawals.
            </Text>
          </View>
          <Toggle value={isDefault} onChange={setIsDefault} />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <GradientButton
            label="Save bank account"
            loading={add.isPending}
            disabled={add.isPending}
            onPress={submit}
          />
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
