import { ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { StatusBar } from "expo-status-bar";
import { QueryProvider } from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";
import { AuthProvider } from "./AuthProvider";
import { WsProvider } from "./WsProvider";
import { UserEventsProvider } from "./UserEventsProvider";
import { ToastProvider } from "./ToastProvider";
import { useThemeStore } from "@shared/store/theme.store";
import { TradeSheetProvider } from "@features/trade/components/TradeSheetProvider";

interface Props {
  children: ReactNode;
}

// Isolated leaf so theme changes only re-render the status-bar layer
// instead of cascading a re-render through every provider and screen.
// Previously AppProviders subscribed to `resolved` directly, which made
// the entire provider tree re-render on every Appearance tick — that's
// what made the login/register screens look like they were refreshing.
function ThemedStatusBar() {
  const resolved = useThemeStore((s) => s.resolved);
  return <StatusBar style={resolved === "light" ? "dark" : "light"} />;
}

export function AppProviders({ children }: Props) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <WsProvider>
                <UserEventsProvider>
                  <BottomSheetModalProvider>
                    <TradeSheetProvider>
                      <ToastProvider>
                        <ThemedStatusBar />
                        {children}
                      </ToastProvider>
                    </TradeSheetProvider>
                  </BottomSheetModalProvider>
                </UserEventsProvider>
              </WsProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
