import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@shared/components/Screen";
import { Header } from "@shared/components/Header";
import { Text } from "@shared/ui/Text";
import { colors, radii } from "@shared/theme";
import { useUiStore } from "@shared/store/ui.store";

// JSON manifest hosted in the GitHub repo. Bump app-version.json on main
// each time a new APK is published and every user sees the update on
// next visit. No backend changes needed.
const VERSION_MANIFEST_URL =
  "https://raw.githubusercontent.com/shivammacoss/marginplant_apk/main/app-version.json";

interface VersionManifest {
  version: string;
  build: number;
  released_at: string;
  apk_url: string;
  changelog: string[];
  force_update?: boolean;
}

// Current build number is set in app.json -> android.versionCode. EAS
// builds inject the resolved values into expo-constants at compile time.
function currentBuild(): number {
  const native = Updates.runtimeVersion;
  const explicit = (Constants.expoConfig?.android as { versionCode?: number } | undefined)
    ?.versionCode;
  if (typeof explicit === "number") return explicit;
  // Fallback parses the runtimeVersion ("appVersion" policy → semver) so a
  // dev build with no native versionCode still resolves to something.
  const parts = (native ?? "0").split(".").map((p) => Number(p) || 0);
  return parts.reduce((acc, n, i) => acc + n * Math.pow(100, parts.length - 1 - i), 0);
}

function currentVersion(): string {
  return Constants.expoConfig?.version ?? Updates.runtimeVersion ?? "0.0.0";
}

export function UpdateScreen() {
  const [manifest, setManifest] = useState<VersionManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingOta, setCheckingOta] = useState(false);
  const pushToast = useUiStore((s) => s.pushToast);

  const fetchManifest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cache-bust so the user always sees the freshest manifest after
      // a deploy — the public GitHub Raw CDN otherwise serves the last
      // version for up to 5 minutes.
      const url = `${VERSION_MANIFEST_URL}?t=${Date.now()}`;
      const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as VersionManifest;
      setManifest(json);
    } catch (e) {
      setError((e as Error).message || "Couldn't reach update server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchManifest();
  }, [fetchManifest]);

  const me = useMemo(
    () => ({ version: currentVersion(), build: currentBuild() }),
    [],
  );

  const hasNewBuild =
    !!manifest && (manifest.build > me.build || manifest.version !== me.version);

  const onCheckOta = useCallback(async () => {
    if (checkingOta) return;
    setCheckingOta(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        pushToast({ kind: "success", message: "Update downloaded — restarting…" });
        // Reload applies the new JS bundle. Tiny delay so the toast shows.
        setTimeout(() => {
          void Updates.reloadAsync();
        }, 600);
      } else {
        pushToast({ kind: "info", message: "You're on the latest version" });
      }
    } catch (e) {
      pushToast({
        kind: "error",
        message: (e as Error).message || "Update check failed",
      });
    } finally {
      setCheckingOta(false);
    }
  }, [checkingOta, pushToast]);

  const onDownloadApk = useCallback(async () => {
    if (!manifest?.apk_url) return;
    try {
      await Linking.openURL(manifest.apk_url);
    } catch {
      Alert.alert("Couldn't open link", "Open this URL in your browser:\n" + manifest.apk_url);
    }
  }, [manifest]);

  return (
    <Screen padded={false}>
      <Header title="App updates" back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <View
          style={{
            padding: 16,
            borderRadius: radii.lg,
            backgroundColor: colors.bgElevated,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text size="xs" tone="dim" style={{ letterSpacing: 0.8 }}>
            INSTALLED
          </Text>
          <Text style={{ fontSize: 22, fontWeight: "700", marginTop: 6 }}>
            v{me.version}
          </Text>
          <Text tone="muted" size="xs" style={{ marginTop: 2 }}>
            Build {me.build}
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 32, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text tone="muted" size="sm" style={{ marginTop: 8 }}>
              Checking for updates…
            </Text>
          </View>
        ) : error ? (
          <View
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: radii.md,
              backgroundColor: "rgba(239,68,68,0.08)",
              borderWidth: 1,
              borderColor: "rgba(239,68,68,0.25)",
            }}
          >
            <Text tone="sell" size="sm" style={{ fontWeight: "600" }}>
              Couldn't check for updates
            </Text>
            <Text tone="muted" size="xs" style={{ marginTop: 4 }}>
              {error}
            </Text>
            <Pressable onPress={fetchManifest} style={{ marginTop: 10 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radii.sm,
                  backgroundColor: colors.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text size="sm" style={{ fontWeight: "600" }}>
                  Retry
                </Text>
              </View>
            </Pressable>
          </View>
        ) : manifest ? (
          <View
            style={{
              marginTop: 12,
              padding: 16,
              borderRadius: radii.lg,
              backgroundColor: hasNewBuild ? "rgba(168,85,247,0.10)" : colors.bgElevated,
              borderWidth: 1,
              borderColor: hasNewBuild ? colors.primary : colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons
                name={hasNewBuild ? "cloud-download-outline" : "checkmark-circle-outline"}
                size={20}
                color={hasNewBuild ? colors.primary : colors.buy}
              />
              <Text size="xs" tone="dim" style={{ letterSpacing: 0.8 }}>
                {hasNewBuild ? "UPDATE AVAILABLE" : "UP TO DATE"}
              </Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: "700", marginTop: 6 }}>
              v{manifest.version}
            </Text>
            <Text tone="muted" size="xs" style={{ marginTop: 2 }}>
              Build {manifest.build} · Released {manifest.released_at}
            </Text>

            {manifest.changelog?.length ? (
              <View style={{ marginTop: 14, gap: 6 }}>
                <Text size="xs" tone="dim" style={{ letterSpacing: 0.8 }}>
                  WHAT'S NEW
                </Text>
                {manifest.changelog.map((line, i) => (
                  <View
                    key={i}
                    style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
                  >
                    <Text tone="muted" style={{ marginTop: 2 }}>
                      •
                    </Text>
                    <Text size="sm" style={{ flex: 1, lineHeight: 20 }}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {hasNewBuild ? (
              <Pressable onPress={onDownloadApk} style={{ marginTop: 16 }}>
                <View
                  style={{
                    paddingVertical: 14,
                    borderRadius: radii.md,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    Download new version
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable onPress={onCheckOta} style={{ marginTop: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bgElevated,
            }}
          >
            {checkingOta ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.text} />
            )}
            <Text style={{ fontWeight: "600" }}>
              {checkingOta ? "Checking…" : "Check for over-the-air updates"}
            </Text>
          </View>
        </Pressable>
        <Text tone="dim" size="xs" style={{ marginTop: 8, textAlign: "center" }}>
          Over-the-air updates apply small fixes without reinstalling the APK.
        </Text>
      </ScrollView>
    </Screen>
  );
}
