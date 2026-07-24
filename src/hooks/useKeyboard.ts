import { useEffect, useRef } from "react";
import type { AppAction } from "../types";

const KEY_ACTIONS: Record<string, AppAction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  Enter: "confirm",
  Backspace: "back",
  Escape: "back",
  " ": "togglePlayback",
  ArrowLeft: "left",
  ArrowRight: "right",
  ",": "playbackRateDown",
  ".": "playbackRateUp",
  "[": "volumeDown",
  "]": "volumeUp",
  s: "subtitle",
  q: "queue",
  v: "toggleSpectrum",
  b: "blackout",
  c: "captureScreenshot",
  h: "toggleHelp",
  f: "fullscreen",
};

export function useKeyboard(onAction: (action: AppAction) => void): void {
  const callbackRef = useRef(onAction);
  callbackRef.current = onAction;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = KEY_ACTIONS[event.key];
      if (!action) return;
      event.preventDefault();
      callbackRef.current(action);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
