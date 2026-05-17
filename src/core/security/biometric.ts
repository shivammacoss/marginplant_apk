import * as LocalAuthentication from "expo-local-authentication";

// Module-level cache: hardware support + enrolment don't change while
// the app is running. Without caching, every biometric prompt paid the
// cost of two native-bridge calls BEFORE the fingerprint UI appeared
// (~150-300 ms on Android). Cached now — first call fills, every later
// call returns synchronously.
let _supportedCache: boolean | null = null;
let _kindCache: "face" | "fingerprint" | "iris" | "none" | null = null;
let _supportPromise: Promise<boolean> | null = null;

export async function isBiometricSupported(): Promise<boolean> {
  if (_supportedCache !== null) return _supportedCache;
  // Coalesce concurrent calls — multiple components calling
  // useBiometric() simultaneously share the same in-flight promise.
  if (!_supportPromise) {
    _supportPromise = (async () => {
      const [hw, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      _supportedCache = hw && enrolled;
      return _supportedCache;
    })();
  }
  return _supportPromise;
}

export async function getBiometricKind(): Promise<"face" | "fingerprint" | "iris" | "none"> {
  if (_kindCache !== null) return _kindCache;
  if (!(await LocalAuthentication.hasHardwareAsync())) {
    _kindCache = "none";
    return _kindCache;
  }
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION))
    _kindCache = "face";
  else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT))
    _kindCache = "fingerprint";
  else if (types.includes(LocalAuthentication.AuthenticationType.IRIS))
    _kindCache = "iris";
  else _kindCache = "none";
  return _kindCache;
}

export async function authenticate(prompt = "Authenticate to continue"): Promise<boolean> {
  // Skip the redundant `isBiometricSupported` round-trip when we've
  // already determined support at hook init. `authenticateAsync` itself
  // returns `success: false` if hardware/enrolment isn't there, so the
  // safety check is cosmetic on the happy path and a wasted ~80 ms on
  // every fingerprint prompt.
  if (_supportedCache === false) return false;
  if (_supportedCache === null) {
    const ok = await isBiometricSupported();
    if (!ok) return false;
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    disableDeviceFallback: false,
    cancelLabel: "Cancel",
  });
  return result.success;
}

// Warm the cache eagerly — call this from app boot so the first
// biometric prompt doesn't pay the native bridge cost.
export function preloadBiometricCapability(): void {
  void isBiometricSupported();
  void getBiometricKind();
}

// Synchronous cache accessors. Return null when the async warmer hasn't
// finished yet, the real value once it has. Used by `useBiometric` to
// seed its initial state — when `preloadBiometricCapability()` has
// already run during boot, the first render of any biometric-aware
// screen sees `supported = true` immediately instead of waiting for
// its own useEffect to resolve.
export function getCachedBiometricSupport(): boolean | null {
  return _supportedCache;
}

export function getCachedBiometricKind(): "face" | "fingerprint" | "iris" | "none" | null {
  return _kindCache;
}
