import { memo } from "react";
import { Pressable, View } from "react-native";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";

export interface OptionChainSide {
  oi: number;
  oiChangePct: number;
  ltp: number;
  ltpChangePct: number;
}

interface Props {
  strike: number;
  call: OptionChainSide;
  put: OptionChainSide;
  highlight?: "support" | "resistance" | "max-pain";
  onPress?: (side: "CALL" | "PUT") => void;
}

function SideCell({ side, kind }: { side: OptionChainSide; kind: "CALL" | "PUT" }) {
  const oiTone = colors.buy;
  const ltpTone = side.ltpChangePct >= 0 ? colors.buy : colors.sell;
  return (
    <View style={{ flex: 1, alignItems: kind === "CALL" ? "flex-start" : "flex-end" }}>
      <Text style={{ fontSize: 14, fontWeight: "500" }}>{side.ltp.toFixed(2)}</Text>
      <Text style={{ color: ltpTone, fontSize: 11 }}>{side.ltpChangePct.toFixed(0)}%</Text>
      <Text style={{ color: oiTone, fontSize: 12, fontWeight: "600", marginTop: 6 }}>
        {side.oi.toFixed(2)}
      </Text>
      <Text style={{ color: oiTone, fontSize: 11 }}>{side.oiChangePct.toFixed(0)}%</Text>
    </View>
  );
}

function OptionChainRowImpl({ strike, call, put, highlight, onPress }: Props) {
  return (
    <Pressable
      onPress={() => onPress?.("CALL")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <SideCell side={call} kind="CALL" />
      <View style={{ width: 100, alignItems: "center", gap: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: "500" }}>{strike}</Text>
        {highlight ? (
          <View
            style={{
              backgroundColor: highlight === "max-pain" ? "#7c2d12" : colors.buyDim,
              borderRadius: 4,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: highlight === "max-pain" ? colors.warn : colors.buy,
                fontSize: 9,
                fontWeight: "600",
              }}
            >
              {highlight === "support" ? "OI Support" : highlight === "resistance" ? "OI Resistance" : "Max Pain"}
            </Text>
          </View>
        ) : null}
      </View>
      <SideCell side={put} kind="PUT" />
    </Pressable>
  );
}

export const OptionChainRow = memo(OptionChainRowImpl);
