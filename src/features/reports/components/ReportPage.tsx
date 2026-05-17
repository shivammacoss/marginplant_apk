import { memo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Loader } from "@shared/ui/Loader";
import { Text } from "@shared/ui/Text";
import { Card } from "@shared/ui/Card";
import { colors, spacing } from "@shared/theme";
import { useManualRefresh } from "@shared/hooks/useManualRefresh";
import {
  useDownloadReportPdf,
  type ReportKind,
} from "@features/reports/hooks/useDownloadReportPdf";

interface Props {
  title: string;
  isLoading: boolean;
  isError: boolean;
  // Kept for backwards compatibility — no longer drives the RefreshControl
  // spinner (that's manual-only now). Callers can leave it unset.
  isRefetching?: boolean;
  errorMessage?: string;
  onRefresh: () => Promise<unknown> | void;
  empty?: boolean;
  emptyHint?: string;
  children: ReactNode;
  /**
   * When set, a "PDF" download pill is shown next to the back button and
   * wired to /user/reports/{downloadKind}/pdf. Omit to hide the button.
   */
  downloadKind?: ReportKind;
  downloadParams?: Record<string, string | number | undefined>;
}

function ReportPageImpl({
  title,
  isLoading,
  isError,
  errorMessage,
  onRefresh,
  empty,
  emptyHint,
  children,
  downloadKind,
  downloadParams,
}: Props) {
  // Manual-pull spinner only — background polls don't flash the spinner.
  const { refreshing, onRefresh: handleRefresh } = useManualRefresh(
    async () => {
      await onRefresh();
    },
  );
  const { download, downloading } = useDownloadReportPdf();
  const isThisDownloading = downloadKind != null && downloading === downloadKind;

  return (
    <Screen padded={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
        }}
      >
        <View style={{ flex: 1 }}>
          <Header title={title} back />
        </View>
        {downloadKind ? (
          <Pressable
            onPress={() => void download(downloadKind, downloadParams)}
            disabled={isLoading || isThisDownloading}
            hitSlop={8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: colors.bgElevated,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: isLoading || isThisDownloading ? 0.6 : 1,
              marginLeft: 8,
            }}
          >
            {isThisDownloading ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
            ) : (
              <Ionicons
                name="download-outline"
                size={14}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
            )}
            <Text
              size="xs"
              style={{
                color: colors.primary,
                fontWeight: "700",
                letterSpacing: 0.4,
              }}
            >
              {isThisDownloading ? "Building…" : "PDF"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        {isLoading ? (
          <Loader label={`Loading ${title.toLowerCase()}…`} />
        ) : isError ? (
          <Card>
            <Text tone="sell">{errorMessage ?? `Couldn't load ${title}`}</Text>
          </Card>
        ) : empty ? (
          <View style={{ paddingVertical: 48, alignItems: "center" }}>
            <Text tone="muted">{emptyHint ?? "No data yet"}</Text>
          </View>
        ) : (
          children
        )}
      </ScrollView>
    </Screen>
  );
}

export const ReportPage = memo(ReportPageImpl);

export function ReportRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "buy" | "sell" | "muted";
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <Text tone="muted" size="sm">
        {label}
      </Text>
      <Text mono style={{ fontWeight: "600", color: toneColor(tone) }}>
        {value}
      </Text>
    </View>
  );
}

function toneColor(tone?: "default" | "buy" | "sell" | "muted"): string {
  switch (tone) {
    case "buy":
      return colors.buy;
    case "sell":
      return colors.sell;
    case "muted":
      return colors.textMuted;
    default:
      return colors.text;
  }
}
