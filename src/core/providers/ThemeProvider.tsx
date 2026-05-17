import { ReactNode, createContext, useContext, useMemo } from "react";
import { theme, type Theme } from "@shared/theme";

const ThemeCtx = createContext<Theme>(theme);

interface Props {
  children: ReactNode;
}

export function ThemeProvider({ children }: Props) {
  const value = useMemo(() => theme, []);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeCtx);
}
