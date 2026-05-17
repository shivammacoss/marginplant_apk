import { memo, useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { colors } from "@shared/theme";

interface Props {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}

function OtpInputImpl({ length = 6, value, onChange, autoFocus = true }: Props) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => ref.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <View style={{ position: "relative" }}>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
      />
      <View style={{ flexDirection: "row", gap: 12 }}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length;
          const isCursor = focused && i === value.length;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 56,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: isCursor ? colors.primary : colors.border,
                backgroundColor: colors.bgElevated,
                alignItems: "center",
                justifyContent: "center",
              }}
              onTouchEnd={() => ref.current?.focus()}
            >
              <View
                style={{
                  width: filled ? 10 : 0,
                  height: filled ? 10 : 0,
                  borderRadius: 5,
                  backgroundColor: colors.text,
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const OtpInput = memo(OtpInputImpl);
