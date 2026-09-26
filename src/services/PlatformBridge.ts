export type HostPlatform = 'web_browser' | 'android_webview' | 'android_pwa' | 'desktop_wrapper';

export interface PlatformCapabilities {
  platform: HostPlatform;
  hasSpeechRecognition: boolean;
  hasSpeechSynthesis: boolean;
  hasVibration: boolean;
  hasMediaSession: boolean;
  canDirectLaunchUrl: boolean;
  supportsBackgroundWakeWord: boolean;
}

export class PlatformBridge {
  private static instance: PlatformBridge | null = null;
  private currentPlatform: HostPlatform = 'web_browser';

  private constructor() {
    this.detectPlatform();
  }

  public static getInstance(): PlatformBridge {
    if (!this.instance) {
      this.instance = new PlatformBridge();
    }
    return this.instance;
  }

  private detectPlatform(): void {
    if (typeof window === 'undefined') return;

    // Check Android WebView bridge or Flutter JavascriptChannel
    const hasAndroidBridge = Boolean((window as any).AndroidBridge || (window as any).flutter_inappwebview);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (hasAndroidBridge) {
      this.currentPlatform = 'android_webview';
    } else if (isStandalone && /android/i.test(navigator.userAgent)) {
      this.currentPlatform = 'android_pwa';
    } else {
      this.currentPlatform = 'web_browser';
    }
  }

  public getCapabilities(): PlatformCapabilities {
    const hasSpeechRecognition =
      typeof window !== 'undefined' &&
      Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const hasSpeechSynthesis = typeof window !== 'undefined' && Boolean(window.speechSynthesis);
    const hasVibration = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    const hasMediaSession = typeof navigator !== 'undefined' && Boolean(navigator.mediaSession);

    return {
      platform: this.currentPlatform,
      hasSpeechRecognition,
      hasSpeechSynthesis,
      hasVibration,
      hasMediaSession,
      canDirectLaunchUrl: true,
      supportsBackgroundWakeWord: this.currentPlatform === 'android_webview',
    };
  }

  /**
   * Launch external destination with fail-safe detection
   */
  public openDestination(
    url: string,
    options?: { target?: string; onBlocked?: () => void }
  ): { opened: boolean; isBlocked: boolean } {
    if (!url) return { opened: false, isBlocked: false };

    try {
      // If Android bridge is present, dispatch native Android Intent
      if ((window as any).AndroidBridge?.launchIntent) {
        (window as any).AndroidBridge.launchIntent(url);
        return { opened: true, isBlocked: false };
      }

      // Standard browser window.open
      const openedWindow = window.open(url, options?.target || '_blank', 'noopener,noreferrer');
      const isBlocked = !openedWindow || openedWindow.closed || typeof openedWindow.closed === 'undefined';

      if (isBlocked && options?.onBlocked) {
        options.onBlocked();
      }

      return { opened: !isBlocked, isBlocked };
    } catch (err) {
      console.warn('[PlatformBridge] Failed opening destination:', err);
      return { opened: false, isBlocked: true };
    }
  }

  /**
   * Safe Haptic Trigger (works on both mobile browser and Android bridge)
   */
  public triggerHaptic(pattern: number | number[] = 20): void {
    try {
      if ((window as any).AndroidBridge?.vibrate) {
        (window as any).AndroidBridge.vibrate(Array.isArray(pattern) ? pattern[0] : pattern);
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  }
}

export const globalPlatformBridge = PlatformBridge.getInstance();
