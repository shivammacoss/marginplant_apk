import { memo, useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { useTicker } from "@features/trade/hooks/useTicker";
import { usePlaceOrder } from "@features/trade/hooks/usePlaceOrder";
import { useUiStore } from "@shared/store/ui.store";
import { formatNumber } from "@shared/utils/format";
import { sounds } from "@shared/services/sounds";
import type { OrderAction } from "@features/trade/types/order.types";

interface Props {
  token: string | null | undefined;
  symbol?: string;
  lots: string;
  onLotsChange: (v: string) => void;
  step?: number;
  minLots?: number;
}

const STEP_BLUE = "#2962FF";
const SELL_RED = "#EF4444";
const BUY_GREEN = "#22C55E";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// No `loading` prop — the button never enters a visible "sending" state.
// The mutation fires in the background; the user sees the price the whole
// time and can tap again as fast as they like. Toast + navigation confirm
// the order asynchronously.
function SideBox({
  kind,
  price,
  onPress,
}: {
  kind: OrderAction;
  price: number | undefined;
  onPress: () => void;
}) {
  const bg = kind === "BUY" ? BUY_GREEN : SELL_RED;
  const noPrice = price == null;
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: bg,
          borderRadius: 6,
          paddingVertical: 6,
          paddingHorizontal: 10,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 9,
            fontWeight: "600",
            textAlign: "right",
            opacity: 0.92,
          }}
        >
          {kind === "BUY" ? "buy" : "sell"}
        </Text>
        <Text
          style={{
            color: "#fff",
            fontSize: 14,
            fontWeight: "700",
            marginTop: -1,
          }}
        >
          {noPrice ? "—" : formatNumber(price as number, 2)}
        </Text>
      </View>
    </Pressable>
  );
}

function StepButton({ dir, onPress }: { dir: "minus" | "plus"; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      hitSlop={8}
    >
      <View
        style={{
          width: 30,
          height: 34,
          borderRadius: 6,
          backgroundColor: STEP_BLUE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={dir === "plus" ? "add" : "remove"} size={18} color="#fff" />
      </View>
    </Pressable>
  );
}

function BuySellBarImpl({
  token,
  symbol,
  lots,
  onLotsChange,
  step = 0.01,
  minLots = 0.01,
}: Props) {
  const tick = useTicker(token ?? null);
  const live = token ? tick : undefined;
  const bid = live?.bid ?? live?.ltp;
  const ask = live?.ask ?? live?.ltp;
  const place = usePlaceOrder();
  const pushToast = useUiStore((s) => s.pushToast);

  // Lightweight throttle so a panicked triple-tap doesn't fire 3 orders in
  // 50 ms — 250 ms is well below any human's "two distinct taps" threshold
  // but high enough that one accidental long press doesn't double-fire.
  const lastFireAt = useRef(0);

  function bump(direction: 1 | -1): void {
    const next = Math.max(minLots, +(num(lots) + direction * step).toFixed(4));
    onLotsChange(String(next));
  }

  function fire(action: OrderAction): void {
    // Throttle FIRST — guards against React 19 strict-mode double-invoke + any
    // accidental double-tap. 350 ms is below any human's "two distinct
    // taps" threshold but high enough that a single long press doesn't fire 2.
    const now = Date.now();
    if (now - lastFireAt.current < 350) return;
    lastFireAt.current = now;

    if (!token) {
      pushToast({ kind: "warn", message: "Pick an instrument from Search to trade" });
      return;
    }
    const value = num(lots);
    if (value <= 0) {
      pushToast({ kind: "warn", message: "Enter lots greater than 0" });
      return;
    }
    // Audible + haptic confirmation the instant the press is accepted.
    // Plays one of the bundled tones (`assets/sounds/{buy,sell}.mp3`) and
    // pulses a haptic. Replaces the previous text-to-speech ("buy"/"sell"
    // voice) the user asked us to remove — now it's a discreet tone
    // instead of a robotic voice. Falls back to haptic-only on Android
    // when no sound file has been bundled yet.
    if (action === "BUY") sounds.buy();
    else sounds.sell();
    place.mutate({
      token,
      action,
      order_type: "MARKET",
      product_type: "MIS",
      lots: value,
      // UI-only hints — stripped before HTTP. Lets usePlaceOrder build a
      // properly-labelled optimistic Position row so the Portfolio tab
      // shows the new trade with the real symbol (not the raw token).
      _displaySymbol: symbol,
    });
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: colors.bg,
      }}
    >
      <SideBox kind="SELL" price={bid} onPress={() => fire("SELL")} />
      <StepButton dir="minus" onPress={() => bump(-1)} />
      <View
        style={{
          minWidth: 44,
          paddingHorizontal: 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TextInput
          value={lots}
          onChangeText={onLotsChange}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={{
            color: colors.text,
            fontSize: 14,
            fontWeight: "700",
            textAlign: "center",
            padding: 0,
            minWidth: 44,
          }}
          accessibilityLabel="Lots"
          accessibilityHint={symbol ? `${symbol} lots` : "Lots"}
        />
      </View>
      <StepButton dir="plus" onPress={() => bump(1)} />
      <SideBox kind="BUY" price={ask} onPress={() => fire("BUY")} />
    </View>
  );
}

export const BuySellBar = memo(BuySellBarImpl);
