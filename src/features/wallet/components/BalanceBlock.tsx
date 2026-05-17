import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { formatINR } from "@shared/utils/format";

interface Row {
  label: string;
  amount: string;
  onPress?: () => void;
}

interface Props {
  rows: Row[];
}

function BalanceBlockImpl({ rows }: Props) {
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: 16,
        paddingHorizontal: 16,
      }}
    >
      {rows.map((r, i) => (
        <Pressable key={r.label} onPress={r.onPress}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 18,
              borderBottomWidth: i === rows.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ flex: 1, fontSize: 15 }}>{r.label}</Text>
            <Text style={{ fontSize: 15, fontWeight: "500", marginRight: 8 }}>
              {formatINR(r.amount)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export const BalanceBlock = memo(BalanceBlockImpl);
