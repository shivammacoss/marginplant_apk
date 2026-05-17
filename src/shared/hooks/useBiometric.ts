import { useCallback, useEffect, useState } from "react";
import {
  authenticate,
  getBiometricKind,
  getCachedBiometricKind,
  getCachedBiometricSupport,
  isBiometricSupported,
} from "@core/security/biometric";

type Kind = "face" | "fingerprint" | "iris" | "none";

export function useBiometric() {
  // Seed from the module-level cache so a component that mounts AFTER
  // `preloadBiometricCapability()` runs in app/_layout.tsx already
  // knows `supported = true` on its first render — and pin-enter's
  // auto-prompt useEffect can fire in the SAME render commit, not
  // after a ~300 ms async resolution.
  const [supported, setSupported] = useState<boolean>(
    () => getCachedBiometricSupport() ?? false,
  );
  const [kind, setKind] = useState<Kind>(
    () => getCachedBiometricKind() ?? "none",
  );

  useEffect(() => {
    // If cache hit already gave us a real answer, skip the async work.
    if (getCachedBiometricSupport() !== null) return;
    void (async () => {
      const [s, k] = await Promise.all([isBiometricSupported(), getBiometricKind()]);
      setSupported(s);
      setKind(k);
    })();
  }, []);

  const prompt = useCallback((label?: string) => authenticate(label), []);

  return { supported, kind, prompt };
}
