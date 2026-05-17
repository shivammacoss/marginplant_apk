import { memo, type ReactNode } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { Chip } from "@shared/ui/Chip";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  chips: string[];
  onChipPress?: (label: string) => void;
}

function ScannerGroupImpl({ icon, title, chips, onChipPress }: Props) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{title}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {chips.map((c) => (
          <Chip key={c} label={c} size="sm" onPress={() => onChipPress?.(c)} />
        ))}
      </View>
    </View>
  );
}

export const ScannerGroup = memo(ScannerGroupImpl);
