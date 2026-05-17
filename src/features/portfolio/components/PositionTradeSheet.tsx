import { memo, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { colors, radii, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatINR } from "@shared/utils/format";
import { InlineTradePanel } from "@features/portfolio/components/InlineTradePanel";
import type { PositionRowData } from "@features/portfolio/components/PositionRowV2";

interface Props {
  /** When set, the sheet is visible for THIS position. null = closed. */
  position: PositionRowData | null;
  /** Closes the sheet. Called by backdrop tap, drag-down, or after close. */
  onClose: () => void;
  /** Exit the entire position. Wired to useSquareoffPosition by parent. */
  onExitPosition: () => void;
  closing?: boolean;
}

function Backdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.5}
      pressBehavior="close"
    />
  );
}

// Floating trade panel that slides up from the bottom when the user taps
// a Position row. Replaces the earlier inline expansion which crowded
// the card and shifted the list under the user's tap. The sheet sits
// ON TOP of the page so the original position card stays in view at its
// normal size — exactly what the user asked for ("card opne ho upar me
// or card thoda sa small ho").
function PositionTradeSheetImpl({
  position,
  onClose,
  onExitPosition,
  closing,
}: Props) {
  const sheet = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["72%"], []);

  // Open / close based on whether a position is set.
  useEffect(() => {
    if (position) {
      // Defer one frame so the sheet's container measures the new
      // content before the snap animation runs — without this, the
      // first open lands at a tiny height (a known @gorhom/bottom-sheet
      // measurement race we already work around in TradeSheet.tsx).
      requestAnimationFrame(() => sheet.current?.snapToIndex(0));
    } else {
      sheet.current?.close();
    }
  }, [position]);

  return (
    <BottomSheet
      ref={sheet}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={Backdrop}
      onClose={onClose}
      backgroundStyle={{ backgroundColor: colors.bgElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.textDim }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        {position && position.instrument_token ? (
          <View
            style={{
              flex: 1,
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.lg,
            }}
          >
            {/* Compact header — symbol, side badge, qty/lots, P&L.
                Same info as the row card but condensed so the body
                of the sheet has room for the trade controls. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: spacing.sm,
                marginBottom: 4,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 4,
                  backgroundColor:
                    position.side === "BUY" ? colors.buyDim : colors.sellDim,
                }}
              >
                <Text
                  style={{
                    color: position.side === "BUY" ? colors.buy : colors.sell,
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 0.5,
                  }}
                >
                  {position.side}
                </Text>
              </View>
              <Text
                style={{ flex: 1, fontSize: 16, fontWeight: "700" }}
                numberOfLines={1}
              >
                {position.symbol}
              </Text>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: colors.bgSurface,
                }}
              >
                <Text
                  mono
                  size="xs"
                  style={{ fontWeight: "700", color: colors.textMuted }}
                >
                  {position.lots != null && position.lots > 0
                    ? `${(+position.lots.toFixed(2)).toString()}L · ${position.quantity}`
                    : `×${position.quantity}`}
                </Text>
              </View>
              <Text
                mono
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color:
                    position.pnl > 0
                      ? colors.buy
                      : position.pnl < 0
                        ? colors.sell
                        : colors.text,
                }}
              >
                {position.pnl > 0 ? "+" : ""}
                {formatINR(position.pnl)}
              </Text>
            </View>

            <InlineTradePanel
              token={position.instrument_token}
              symbol={position.symbol}
              positionQty={position.quantity}
              positionSide={position.side}
              onExit={onExitPosition}
              closing={closing}
            />
          </View>
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  );
}

export const PositionTradeSheet = memo(PositionTradeSheetImpl);
