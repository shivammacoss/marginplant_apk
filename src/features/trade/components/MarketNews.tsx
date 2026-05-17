import { memo } from "react";
import { Image, Linking, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@core/api/client";
import { unwrap } from "@core/api/errors";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";

export interface NewsItem {
  id: string;
  title: string;
  summary?: string | null;
  source?: string | null;
  url?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  tag?: string | null;
}

const NEWS_KEY = ["market", "news"] as const;

async function fetchNews(): Promise<NewsItem[]> {
  // Backend aggregates Indian financial-news RSS (Moneycontrol, ET, Mint,
  // BS) and caches the merged response for 5 min — first warm hit ~1 ms.
  try {
    return await unwrap<NewsItem[]>(api.get("/user/news", { params: { limit: 40 } }));
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 404) return [];
    throw e;
  }
}

export const NEWS_QUERY_KEY = NEWS_KEY;
export const fetchMarketNews = fetchNews;

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function NewsRow({
  item,
  showDivider,
}: {
  item: NewsItem;
  showDivider?: boolean;
}) {
  const onPress = () => {
    if (item.url) void Linking.openURL(item.url);
  };
  return (
    <Pressable onPress={onPress} disabled={!item.url}>
      <View
        style={{
          flexDirection: "row",
          paddingVertical: 14,
          borderBottomWidth: showDivider ? 1 : 0,
          borderBottomColor: colors.border,
        }}
      >
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={{
              width: 84,
              height: 84,
              borderRadius: 10,
              backgroundColor: colors.bgSurface,
              marginRight: 12,
            }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 10,
              backgroundColor: colors.bgSurface,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name="newspaper-outline" size={28} color={colors.textDim} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", lineHeight: 19 }} numberOfLines={2}>
            {item.title}
          </Text>
          {item.summary ? (
            <Text tone="muted" size="xs" style={{ marginTop: 4, lineHeight: 17 }} numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
            {item.source ? (
              <Text size="xs" style={{ color: colors.info, fontWeight: "600" }}>
                {item.source}
              </Text>
            ) : null}
            {item.source && item.published_at ? (
              <Text tone="dim" size="xs" style={{ marginHorizontal: 6 }}>
                ·
              </Text>
            ) : null}
            {item.published_at ? (
              <Text tone="dim" size="xs">
                {timeAgo(item.published_at)}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function MarketNewsImpl() {
  const { data, isLoading, isError } = useQuery<NewsItem[]>({
    queryKey: NEWS_KEY,
    queryFn: fetchNews,
    // Backend caches the aggregate for 5 min; refresh every 3 min so
    // the user sees new headlines as they break.
    staleTime: 3 * 60_000,
    refetchInterval: 3 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
    // Show the last successful headlines while the next refresh lands.
    // Combined with the React Query disk persister this paints cached
    // news in <50 ms on cold start — no "Loading…" delay.
    placeholderData: (prev) => prev,
  });

  const items = data ?? [];

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: items.length > 0 ? 4 : spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: items.length > 0 ? 4 : 8,
        }}
      >
        <Text size="xs" style={{ fontWeight: "700", letterSpacing: 0.8, color: colors.text }}>
          MARKET NEWS
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(96,165,250,0.14)",
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Ionicons name="flag" size={10} color={colors.info} style={{ marginRight: 4 }} />
          <Text
            size="xs"
            style={{ color: colors.info, fontWeight: "700", letterSpacing: 0.5 }}
          >
            INDIAN MARKETS
          </Text>
        </View>
      </View>

      {isLoading ? (
        <Text tone="muted" size="sm" style={{ paddingVertical: 16 }}>
          Loading news…
        </Text>
      ) : isError ? (
        <Text tone="muted" size="sm" style={{ paddingVertical: 16 }}>
          News feed unavailable right now.
        </Text>
      ) : items.length === 0 ? (
        <View style={{ paddingVertical: 16, alignItems: "flex-start" }}>
          <Text tone="muted" size="sm">
            News feed will appear here as soon as a provider is connected.
          </Text>
        </View>
      ) : (
        items.map((n, i) => (
          <NewsRow key={n.id} item={n} showDivider={i < items.length - 1} />
        ))
      )}
    </View>
  );
}

export const MarketNews = memo(MarketNewsImpl);
