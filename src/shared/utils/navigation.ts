import { router } from "expo-router";

export function goBack(fallback: string = "/"): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback as never);
}
