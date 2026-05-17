import { memo, type ReactNode } from "react";
import { View } from "react-native";
import { Text } from "@shared/ui/Text";

interface Props {
  illustration: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

function IllustrationEmptyImpl({ illustration, title, description, action }: Props) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        paddingHorizontal: 24,
      }}
    >
      {illustration}
      <Text style={{ fontSize: 18, fontWeight: "500", textAlign: "center" }}>{title}</Text>
      {description ? (
        <Text tone="muted" style={{ textAlign: "center" }}>
          {description}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export const IllustrationEmpty = memo(IllustrationEmptyImpl);
