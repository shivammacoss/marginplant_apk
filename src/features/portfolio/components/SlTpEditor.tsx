import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { GradientButton } from "@shared/ui/GradientButton";
import { formatNumber } from "@shared/utils/format";
import { useTicker } from "@features/trade/hooks/useTicker";

export interface SlTpEditorProps {
  visible: boolean;
  symbol: string;
  // Used to subscribe to the live WS tick so the "Current Price"
  // displayed in the modal updates in real time while the user types
  // their SL / TP. Without it the modal would freeze on the LTP captured
  // at row-tap time — for fast-moving markets that lag could be enough
  // to overshoot a stop.
  instrumentToken?: string | null;
  side: "BUY" | "SELL";
  entryPrice: number;
  ltp: number;
  initialStopLoss: string | null | undefined;
  initialTarget: string | null | undefined;
  saving?: boolean;
  onClose: () => void;
  /**
   * Pass `null` to clear a leg. Pass a positive number to set it. The hook
   * coerces both into the backend's `Decimal128 | null` shape.
   */
  onSave: (input: {
    stop_loss: number | null;
    target: number | null;
  }) => void;
}

function parseNum(s: string): number | null {
  const v = s.trim();
  if (v === "" || v === "0" || v === "0.") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function SlTpEditor({
  visible,
  symbol,
  instrumentToken,
  side,
  entryPrice,
  ltp: ltpProp,
  initialStopLoss,
  initialTarget,
  saving,
  onClose,
  onSave,
}: SlTpEditorProps) {
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");

  // Live WS tick — only subscribed while the modal is visible. The hook's
  // `useEffect` unsubscribes when the token becomes null, so closing the
  // modal stops the marketdata traffic for this instrument.
  const tick = useTicker(visible && instrumentToken ? instrumentToken : null);
  const liveLtp = tick?.ltp ?? ltpProp;

  // Flash the current-price chip red/green on each tick so the user feels
  // the market moving even while the modal is open. `prevRef` holds the
  // last seen price to compute direction.
  const prevRef = useRef<number>(liveLtp);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (!Number.isFinite(liveLtp)) return;
    const prev = prevRef.current;
    if (Number.isFinite(prev) && prev !== liveLtp) {
      setFlash(liveLtp > prev ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 350);
      prevRef.current = liveLtp;
      return () => clearTimeout(t);
    }
    prevRef.current = liveLtp;
    return undefined;
  }, [liveLtp]);

  // Reset whenever the sheet opens with a new trade.
  useEffect(() => {
    if (visible) {
      setSl(initialStopLoss ? String(initialStopLoss) : "");
      setTp(initialTarget ? String(initialTarget) : "");
    }
  }, [visible, initialStopLoss, initialTarget]);

  const isBuy = side === "BUY";
  // For a long: stop-loss must be BELOW LTP, target ABOVE. Flip for short.
  const slHint = isBuy
    ? "Triggers a SELL when price falls to this level"
    : "Triggers a BUY when price rises to this level";
  const tpHint = isBuy
    ? "Closes when price rises to this level"
    : "Closes when price falls to this level";

  // Light client-side sanity check — server is the source of truth.
  const slNum = parseNum(sl);
  const tpNum = parseNum(tp);
  const slError =
    slNum != null && isBuy && slNum >= liveLtp
      ? "Stop-loss should be below current price"
      : slNum != null && !isBuy && slNum <= liveLtp
      ? "Stop-loss should be above current price"
      : null;
  const tpError =
    tpNum != null && isBuy && tpNum <= liveLtp
      ? "Target should be above current price"
      : tpNum != null && !isBuy && tpNum >= liveLtp
      ? "Target should be below current price"
      : null;

  // Distance from entry → live price (used to size SL/TP relative to risk).
  const pctFromEntry =
    entryPrice > 0
      ? ((liveLtp - entryPrice) / entryPrice) * 100 * (isBuy ? 1 : -1)
      : 0;
  const pctTone =
    pctFromEntry > 0 ? colors.buy : pctFromEntry < 0 ? colors.sell : colors.text;

  function handleSave() {
    onSave({ stop_loss: slNum, target: tpNum });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "flex-end",
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Stop the backdrop tap from closing when the user taps inside */}
          <Pressable onPress={() => undefined}>
            <View
              style={{
                backgroundColor: colors.bg,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                padding: spacing.lg,
                gap: 14,
                paddingBottom: spacing["2xl"],
              }}
            >
              {/* Grab handle */}
              <View
                style={{
                  alignSelf: "center",
                  width: 38,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.textDim,
                  marginBottom: 4,
                }}
              />

              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "800" }}>
                    SL / TP
                  </Text>
                  <Text tone="muted" size="xs">
                    {side} · {symbol}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>

              {/* Big live-price block — Entry + Current Price + % from entry.
                  Subscribes to the same WS feed as the chart so the user
                  sees the market move in real time while setting SL/TP. */}
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: colors.bgElevated,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                }}
              >
                {/* Entry side */}
                <View style={{ flex: 1 }}>
                  <Text
                    tone="dim"
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      letterSpacing: 0.6,
                    }}
                  >
                    ENTRY
                  </Text>
                  <Text
                    mono
                    style={{
                      fontSize: 17,
                      fontWeight: "700",
                      marginTop: 4,
                    }}
                  >
                    {formatNumber(entryPrice, 2)}
                  </Text>
                </View>

                {/* Divider */}
                <View
                  style={{
                    width: 1,
                    alignSelf: "stretch",
                    marginHorizontal: 12,
                    backgroundColor: colors.border,
                  }}
                />

                {/* Live price side */}
                <View style={{ flex: 1.2, alignItems: "flex-end" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor:
                          flash === "up"
                            ? colors.buy
                            : flash === "down"
                            ? colors.sell
                            : colors.buy,
                      }}
                    />
                    <Text
                      tone="dim"
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        letterSpacing: 0.6,
                      }}
                    >
                      LIVE PRICE
                    </Text>
                  </View>
                  <Text
                    mono
                    style={{
                      fontSize: 22,
                      fontWeight: "800",
                      color:
                        flash === "up"
                          ? colors.buy
                          : flash === "down"
                          ? colors.sell
                          : colors.text,
                      marginTop: 2,
                    }}
                  >
                    {Number.isFinite(liveLtp) && liveLtp > 0
                      ? formatNumber(liveLtp, 2)
                      : "—"}
                  </Text>
                  {entryPrice > 0 && Number.isFinite(pctFromEntry) ? (
                    <Text
                      mono
                      size="xs"
                      style={{
                        color: pctTone,
                        fontWeight: "700",
                        marginTop: 2,
                      }}
                    >
                      {pctFromEntry >= 0 ? "+" : ""}
                      {formatNumber(pctFromEntry, 2)}% from entry
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Stop Loss */}
              <View style={{ gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text size="sm" style={{ fontWeight: "700" }}>
                    Stop Loss
                  </Text>
                  {sl ? (
                    <Pressable onPress={() => setSl("")} hitSlop={6}>
                      <Text
                        size="xs"
                        style={{ color: colors.primary, fontWeight: "700" }}
                      >
                        Clear
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <TextInput
                  value={sl}
                  onChangeText={(v) => setSl(v.replace(/[^\d.]/g, ""))}
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  keyboardType="decimal-pad"
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: colors.text,
                    backgroundColor: colors.bgElevated,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: slError ? colors.sell : colors.border,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                />
                <Text
                  size="xs"
                  style={{
                    color: slError ? colors.sell : colors.textDim,
                  }}
                >
                  {slError ?? slHint}
                </Text>
              </View>

              {/* Take Profit */}
              <View style={{ gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text size="sm" style={{ fontWeight: "700" }}>
                    Take Profit
                  </Text>
                  {tp ? (
                    <Pressable onPress={() => setTp("")} hitSlop={6}>
                      <Text
                        size="xs"
                        style={{ color: colors.primary, fontWeight: "700" }}
                      >
                        Clear
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <TextInput
                  value={tp}
                  onChangeText={(v) => setTp(v.replace(/[^\d.]/g, ""))}
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  keyboardType="decimal-pad"
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: colors.text,
                    backgroundColor: colors.bgElevated,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: tpError ? colors.sell : colors.border,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                />
                <Text
                  size="xs"
                  style={{
                    color: tpError ? colors.sell : colors.textDim,
                  }}
                >
                  {tpError ?? tpHint}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <Pressable
                  onPress={onClose}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "700" }}>Cancel</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <GradientButton
                    label={saving ? "Saving…" : "Save"}
                    loading={saving}
                    disabled={saving}
                    onPress={handleSave}
                  />
                </View>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
