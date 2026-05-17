import { memo, type ReactNode } from "react";
import { View } from "react-native";
import { colors } from "@shared/theme";
import { Text } from "@shared/ui/Text";

interface Props {
  title?: string;
  children: ReactNode;
}

function ProfileSectionImpl({ title, children }: Props) {
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {title ? (
        <Text style={{ fontSize: 14, fontWeight: "600", paddingHorizontal: 4, marginBottom: 4 }}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export const ProfileSection = memo(ProfileSectionImpl);
