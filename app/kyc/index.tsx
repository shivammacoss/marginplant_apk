import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { Card } from "@shared/ui/Card";
import { Loader } from "@shared/ui/Loader";
import { Row } from "@shared/ui/Row";
import { Badge } from "@shared/ui/Badge";
import { colors, spacing } from "@shared/theme";
import { fmtDate } from "@shared/utils/time";
import { useKycStatus } from "@features/kyc/hooks/useKyc";
import type { KycStatus } from "@features/kyc/types/kyc.types";

const STATUS_TONE: Record<KycStatus, "neutral" | "buy" | "warn" | "sell"> = {
  PENDING: "neutral",
  SUBMITTED: "warn",
  APPROVED: "buy",
  REJECTED: "sell",
};

export default function KycScreen() {
  const q = useKycStatus();
  const d = q.data;

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header title="KYC" back />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12 }}>
        {q.isLoading ? (
          <Loader label="Checking KYC status…" />
        ) : (
          <>
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontWeight: "700", fontSize: 16 }}>Status</Text>
                <Badge
                  label={d?.status ?? "PENDING"}
                  tone={STATUS_TONE[d?.status ?? "PENDING"]}
                />
              </View>
              {d?.submitted_at ? (
                <Text tone="muted" size="sm">
                  Submitted on {fmtDate(d.submitted_at)}
                </Text>
              ) : null}
              {d?.approved_at ? (
                <Text tone="buy" size="sm">
                  Approved on {fmtDate(d.approved_at)}
                </Text>
              ) : null}
              {d?.rejection_reason ? (
                <View
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: colors.sellDim,
                  }}
                >
                  <Text style={{ color: colors.sell, fontWeight: "600" }}>
                    Rejected
                  </Text>
                  <Text tone="default" size="sm" style={{ marginTop: 2 }}>
                    {d.rejection_reason}
                  </Text>
                </View>
              ) : null}
            </Card>

            <Text tone="muted" size="xs" style={{ marginLeft: 4, marginTop: 6 }}>
              Documents
            </Text>
            <Card padded={false}>
              <Row
                icon="card-outline"
                title="PAN card"
                divider
                onPress={() => router.push("/kyc/pan")}
              />
              <Row
                icon="document-text-outline"
                title="Aadhaar"
                divider
                onPress={() => router.push("/kyc/aadhaar")}
              />
              <Row
                icon="business-outline"
                title="Bank account"
                divider
                onPress={() => router.push("/kyc/bank")}
              />
              <Row
                icon="happy-outline"
                title="Selfie verification"
                onPress={() => router.push("/kyc/selfie")}
              />
            </Card>

            <View style={{ alignItems: "center", marginTop: 12 }}>
              <Ionicons
                name="shield-checkmark-outline"
                size={28}
                color={colors.textDim}
              />
              <Text tone="dim" size="xs" style={{ marginTop: 6, textAlign: "center" }}>
                Your data is encrypted in transit and stored securely.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
