import { memo } from "react";
import { View } from "react-native";
import { colors } from "@shared/theme";

interface Props {
  length: number;
  filled: number;
  cursorAt?: number;
}

function PinDotsImpl({ length, filled, cursorAt }: Props) {
  return (
    <View style={{ flexDirection: "row", gap: 24, alignItems: "center" }}>
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled;
        const isCursor = cursorAt === i;
        if (isCursor && !isFilled) {
          return (
            <View
              key={i}
              style={{ width: 2, height: 28, backgroundColor: colors.text }}
            />
          );
        }
        return (
          <View
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: isFilled ? colors.text : colors.textDim,
            }}
          />
        );
      })}
    </View>
  );
}

export const PinDots = memo(PinDotsImpl);
