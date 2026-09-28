import { useEffect, useRef } from "react";

const EVENTS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;

/** Call `onIdle` after `minutes` without any user activity. */
export function useIdleTimeout(minutes: number | undefined, onIdle: () => void) {
  const callback = useRef(onIdle);
  useEffect(() => {
    callback.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!minutes || minutes <= 0) return;
    const delay = minutes * 60_000;
    let timer = window.setTimeout(() => callback.current(), delay);
    let lastReset = Date.now();

    const reset = () => {
      const now = Date.now();
      if (now - lastReset < 1000) return; // pointermove fires constantly; reset at most once a second
      lastReset = now;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback.current(), delay);
    };

    EVENTS.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [minutes]);
}
