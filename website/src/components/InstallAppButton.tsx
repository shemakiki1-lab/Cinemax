import React, { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Surfaces the browser's native "Install App" flow when available (Chrome,
 * Edge, and most Android browsers). Safari/iOS doesn't support
 * beforeinstallprompt, so we show a short manual-install tip there instead.
 *
 * Note: Cinemax is a Progressive Web App (PWA). There is no native APK file.
 * Users install the app through their browser's native PWA installation flow.
 */
export const InstallAppButton: React.FC<{ variant?: "sidebar" | "card" | "header"; label?: string }> = ({
  variant = "sidebar",
  label = "Install App",
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const [showFallbackInfo, setShowFallbackInfo] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent) && !(window.navigator as any).standalone);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    if (isIOS) {
      setShowIOSTip((v) => !v);
    } else {
      // Show fallback info for desktop browsers without native install prompt
      setShowFallbackInfo((v) => !v);
    }
  };

  if (installed) {
    return (
      <div
        id="install-app-installed"
        className="flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg text-[#39FF14]"
      >
        <Check className="h-4 w-4" />
        <span>App Installed</span>
      </div>
    );
  }

  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="relative">
      <button
        id="install-app-btn"
        onClick={handleInstall}
        className={
          variant === "sidebar"
            ? "flex w-full items-center gap-4 px-4 py-2.5 text-sm rounded-lg hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            : variant === "header"
            ? "hidden md:flex items-center gap-2 bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] px-4 py-2 rounded-2xl text-xs font-bold hover:bg-[#39FF14]/20 transition-all cursor-pointer"
            : "neon-btn flex items-center gap-2 font-extrabold px-5 py-3 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
        }
      >
        <Download className="h-4 w-4 text-neutral-500" />
        <span>{label}</span>
      </button>
      {showIOSTip && (
        <div className="absolute left-0 bottom-full mb-2 w-64 glass-card rounded-xl p-3 text-[11px] text-neutral-300 leading-relaxed shadow-xl z-50">
          On iOS: tap the <strong>Share</strong> icon in Safari, then <strong>"Add to Home Screen"</strong>.
        </div>
      )}
      {showFallbackInfo && !isIOS && (
        <div className="absolute left-0 bottom-full mb-2 w-72 glass-card rounded-xl p-3 text-[11px] text-neutral-300 leading-relaxed shadow-xl z-50">
          <strong className="text-[#39FF14]">Cinemax is a PWA</strong><br />
          Look for the install icon in your browser's address bar, or use the "Add to Home Screen" option in your browser menu.
        </div>
      )}
    </div>
  );
};
