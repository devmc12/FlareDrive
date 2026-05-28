import { Box } from "@mui/material";
import { useEffect, useRef, useState } from "react";

/**
 * Date: 2026-05-28
 * Time: 01:30
 * Desc: Renders the Cloudflare Turnstile widget for password login verification
 */

type TurnstileOptions = {
  sitekey: string;
  action: string;
  theme: "auto";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  disabled?: boolean;
  onTokenChange: (token: string | null) => void;
  onError: (message: string) => void;
};

// Cloudflare Turnstile script loaded explicitly for dynamic React rendering
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Stable script id used to avoid loading Turnstile more than once
const TURNSTILE_SCRIPT_ID = "flaredrive-turnstile-script";

let turnstileScriptPromise: Promise<void> | null = null;

/**
 * Loads the Turnstile browser API once and reuses it across dialog mounts
 * @returns Promise that resolves when window.turnstile is available
 */
function ensureTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(
      TURNSTILE_SCRIPT_ID
    ) as HTMLScriptElement | null;

    const handleLoad = () => {
      existingScript?.setAttribute("data-loaded", "true");
      resolve();
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }

      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", () => reject(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      "load",
      () => {
        script.setAttribute("data-loaded", "true");
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        turnstileScriptPromise = null;
        reject();
      },
      { once: true }
    );
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

/**
 * Renders one managed Turnstile widget and reports its current token
 */
function TurnstileWidget({
  siteKey,
  disabled = false,
  onTokenChange,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    onTokenChange(null);
    setLoading(true);

    ensureTurnstileScript()
      .then(() => {
        if (canceled || !containerRef.current || !window.turnstile) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: "login",
          theme: "auto",
          callback: (token) => onTokenChange(token),
          "expired-callback": () => onTokenChange(null),
          "error-callback": () => {
            onTokenChange(null);
            onError("Turnstile verification failed");
          },
        });
        setLoading(false);
      })
      .catch(() => {
        if (canceled) return;

        setLoading(false);
        onTokenChange(null);
        onError("Turnstile failed to load");
      });

    return () => {
      canceled = true;
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetIdRef.current = null;
      onTokenChange(null);
    };
  }, [siteKey, onError, onTokenChange]);

  return (
    <Box
      sx={{
        minHeight: 70,
        opacity: disabled ? 0.65 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}>
      <Box ref={containerRef} />
      {loading && (
        <Box sx={{ color: "text.secondary", fontSize: 13 }}>
          Loading verification...
        </Box>
      )}
    </Box>
  );
}

export default TurnstileWidget;
