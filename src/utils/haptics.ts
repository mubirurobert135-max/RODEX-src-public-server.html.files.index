// Navigator Vibration API Haptic Feedback Engine for RODEX
// Provides physical confirmation for Mr. Robert on supported devices

export type HapticType =
  | 'tap'         // Quick crisp tap feedback for buttons (20ms)
  | 'activate'    // Dual-stage activation confirmation when RODEX wakes ([35, 45, 65]ms)
  | 'listen'      // Light impulse when microphone listening activates (25ms)
  | 'end'         // Gentle trailing confirmation when call ends ([40, 30, 20]ms)
  | 'interrupt'   // Sharp double-pulse on barge-in ([25, 30, 25]ms)
  | 'success'     // Satisfying multi-pulse for action completion ([30, 40, 30]ms)
  | 'error'       // Quick alert vibration on error ([40, 40, 40]ms)
  | 'warning';    // Notice vibration (30ms)

let hapticsEnabledState = true;

export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabledState = enabled;
}

export function getHapticsEnabled(): boolean {
  return hapticsEnabledState;
}

export function triggerHaptic(type: HapticType = 'tap'): boolean {
  if (!hapticsEnabledState) return false;

  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    if (!('vibrate' in navigator) || typeof navigator.vibrate !== 'function') {
      return false;
    }

    switch (type) {
      case 'tap':
        return navigator.vibrate(22);

      case 'activate':
        // Distinctive Siri/iPhone-style activation cadence
        return navigator.vibrate([35, 45, 65]);

      case 'listen':
        return navigator.vibrate(28);

      case 'end':
        // Decaying soft haptic pattern
        return navigator.vibrate([40, 35, 20]);

      case 'interrupt':
        return navigator.vibrate([25, 30, 25]);

      case 'success':
        return navigator.vibrate([30, 40, 30]);

      case 'error':
        return navigator.vibrate([40, 40, 40]);

      case 'warning':
        return navigator.vibrate(30);

      default:
        return navigator.vibrate(20);
    }
  } catch (err) {
    // Graceful fallback on devices/browsers where vibration is restricted or not permitted
    return false;
  }
}

// Trigger a raw subtle haptic pulse of a specific millisecond duration
export function triggerSubtlePulse(duration: number): boolean {
  if (!hapticsEnabledState) return false;
  try {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      return navigator.vibrate(duration);
    }
  } catch (_) {}
  return false;
}

// Helper to check if the user's current device / browser supports the Vibration API
export function isHapticsSupported(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator;
}
