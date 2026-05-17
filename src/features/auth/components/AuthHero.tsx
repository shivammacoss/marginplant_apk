import { memo } from "react";
import { View } from "react-native";
import { Text } from "@shared/ui/Text";

interface Props {
  title: string;
  subtitle?: string;
}

function AuthHeroImpl({ title, subtitle }: Props) {
  return (
    <View style={{ gap: 8, marginBottom: 32 }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>{title}</Text>
      {subtitle ? (
        <Text tone="muted" size="lg">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export const AuthHero = memo(AuthHeroImpl);
