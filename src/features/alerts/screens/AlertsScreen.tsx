import { useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { Chip } from "@shared/ui/Chip";
import { Loader } from "@shared/ui/Loader";
import { GradientButton } from "@shared/ui/GradientButton";
import { Card } from "@shared/ui/Card";
import { colors, spacing } from "@shared/theme";
import { formatNumber } from "@shared/utils/format";
import { fmtTime } from "@shared/utils/time";
import {
  useAlerts,
  useCreateAlert,
  useDeleteAlert,
} from "@features/alerts/hooks/useAlerts";
import type { AlertType, PriceAlert } from "@features/alerts/types/alert.types";

const TYPE_LABEL: Record<AlertType, string> = {
  LTP_ABOVE: "Price ≥",
  LTP_BELOW: "Price ≤",
  CHANGE_PCT_ABOVE: "% change ≥",
  CHANGE_PCT_BELOW: "% change ≤",
};

function AlertRow({ alert, onRemove }: { alert: PriceAlert; onRemove: () => void }) {
  const triggered = alert.status === "TRIGGERED";
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600" }}>{alert.symbol ?? alert.token}</Text>
          <Text tone="muted" size="sm" style={{ marginTop: 2 }}>
            {TYPE_LABEL[alert.alert_type]} {" "}
            {alert.target_price != null
              ? formatNumber(Number(alert.target_price), 2)
              : alert.target_percent != null
              ? `${Number(alert.target_percent).toFixed(2)}%`
              : "—"}
          </Text>
          <Text tone="dim" size="xs" style={{ marginTop: 4 }}>
            {triggered && alert.triggered_at
              ? `Triggered ${fmtTime(alert.triggered_at)}`
              : `Set ${fmtTime(alert.created_at)} · ${alert.status}`}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.sell} />
        </Pressable>
      </View>
    </Card>
  );
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState("");
  const [type, setType] = useState<AlertType>("LTP_ABOVE");
  const [target, setTarget] = useState("");
  const create = useCreateAlert();

  const isPct = type === "CHANGE_PCT_ABOVE" || type === "CHANGE_PCT_BELOW";

  function submit() {
    const v = Number(target);
    if (!token.trim() || !Number.isFinite(v) || v <= 0) return;
    create.mutate(
      {
        token: token.trim(),
        alert_type: type,
        ...(isPct ? { target_percent: v } : { target_price: v }),
      },
      {
        onSuccess: () => {
          setToken("");
          setTarget("");
          onClose();
        },
      },
    );
  }

  return (
    <Card>
      <Text style={{ fontWeight: "600", marginBottom: 10 }}>New alert</Text>
      <View style={{ gap: 10 }}>
        <View>
          <Text tone="muted" size="xs" style={{ marginBottom: 4, marginLeft: 4 }}>
            Instrument token (use Market search to copy)
          </Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder="e.g. 256265 or FX_EURUSD"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            style={{
              backgroundColor: colors.bg,
              borderRadius: 8,
              padding: 10,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {(Object.keys(TYPE_LABEL) as AlertType[]).map((t) => (
            <Chip
              key={t}
              label={TYPE_LABEL[t]}
              size="sm"
              active={t === type}
              onPress={() => setType(t)}
            />
          ))}
        </View>
        <View>
          <Text tone="muted" size="xs" style={{ marginBottom: 4, marginLeft: 4 }}>
            {isPct ? "Target %" : "Target price"}
          </Text>
          <TextInput
            value={target}
            onChangeText={setTarget}
            placeholder={isPct ? "2.5" : "23500"}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={{
              backgroundColor: colors.bg,
              borderRadius: 8,
              padding: 10,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        </View>
        <GradientButton
          label="Create alert"
          loading={create.isPending}
          onPress={submit}
        />
      </View>
    </Card>
  );
}

export default function AlertsScreen() {
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useAlerts();
  const del = useDeleteAlert();
  const rows = data ?? [];

  function confirmRemove(a: PriceAlert) {
    Alert.alert("Remove alert?", `${a.symbol ?? a.token} ${TYPE_LABEL[a.alert_type]}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => del.mutate(a.id) },
    ]);
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header
          title="Price alerts"
          back
          right={
            <Pressable onPress={() => setShowForm((v) => !v)} hitSlop={8}>
              <Ionicons name={showForm ? "close" : "add"} size={22} color={colors.text} />
            </Pressable>
          }
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 10 }}>
        {showForm ? <CreateForm onClose={() => setShowForm(false)} /> : null}
        {isLoading ? (
          <Loader label="Loading…" />
        ) : rows.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: "center", gap: 6 }}>
            <Ionicons name="alarm-outline" size={36} color={colors.textDim} />
            <Text tone="muted">No alerts yet</Text>
            <Text tone="dim" size="xs">
              Tap + to set a price alert
            </Text>
          </View>
        ) : (
          rows.map((a) => <AlertRow key={a.id} alert={a} onRemove={() => confirmRemove(a)} />)
        )}
      </ScrollView>
    </Screen>
  );
}
