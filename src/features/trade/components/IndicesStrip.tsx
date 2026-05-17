import { memo } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Text } from "@shared/ui/Text";
import { IndexCard } from "./IndexCard";

export interface IndexQuote {
  symbol: string;
  token: string;
  ltp: number;
  change: number;
  changePct: number;
}

interface Props {
  data: IndexQuote[];
}

function IndicesStripImpl({ data }: Props) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Indices</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 16 }}
      >
        {data.map((it) => (
          <IndexCard
            key={it.token}
            symbol={it.symbol}
            token={it.token}
            ltp={it.ltp}
            change={it.change}
            changePct={it.changePct}
            onPress={() => router.push({ pathname: "/(tabs)/trade", params: { token: it.token } })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export const IndicesStrip = memo(IndicesStripImpl);
