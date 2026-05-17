import { AppState } from "react-native";

type Callback = () => void;

export function onSessionExpired(cb: Callback): () => void {
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") cb();
  });
  return () => sub.remove();
}
