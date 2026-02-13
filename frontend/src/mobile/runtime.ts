import { Capacitor } from "@capacitor/core";

export function isNativeMobileShell(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return Boolean((window as any)?.Capacitor?.isNativePlatform?.());
  }
}

export async function bootstrapNativeMobileShell(): Promise<void> {
  if (!isNativeMobileShell()) return;
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("native-mobile-shell");
  }
  try {
    const [{ StatusBar, Style }, { Keyboard, KeyboardResize }] = await Promise.all([
      import("@capacitor/status-bar"),
      import("@capacitor/keyboard"),
    ]);
    await StatusBar.setStyle({ style: Style.Default });
    await StatusBar.setOverlaysWebView({ overlay: false });
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  } catch {
    // Plugins are optional at runtime.
  }
}
