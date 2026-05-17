import { Component, ReactNode } from "react";
import { View } from "react-native";
import { colors, spacing } from "@shared/theme";
import { Text } from "@shared/ui/Text";
import { Button } from "@shared/ui/Button";
import { log } from "@shared/utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string }): void {
    log.error("ErrorBoundary", error.message, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          padding: spacing["2xl"],
          justifyContent: "center",
          gap: spacing.md,
        }}
      >
        <Text variant="title" weight="semibold">
          Something went wrong
        </Text>
        <Text tone="muted" style={{ marginBottom: spacing.lg }}>
          {this.state.error.message}
        </Text>
        <Button label="Reload" onPress={this.reset} />
      </View>
    );
  }
}
