import { useEffect, useRef, useState } from "react";
import type { AppAction, ControllerLayout } from "../types";

interface ControllerState {
  connected: boolean;
  name: string;
  layout: ControllerLayout;
}

const BUTTON_ACTIONS: Partial<Record<number, AppAction>> = {
  0: "confirm",
  1: "back",
  2: "togglePlayback",
  3: "subtitle",
  8: "queue",
  9: "fullscreen",
  10: "toggleSpectrum",
  11: "blackout",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

const TRIGGER_CHORD_GRACE_MS = 80;
const SHOULDER_CHORD_GRACE_MS = 80;

function controllerLayout(id: string): ControllerLayout {
  const value = id.toLowerCase();
  if (value.includes("playstation") || value.includes("dualshock") || value.includes("dualsense")) return "playstation";
  if (value.includes("switch") || value.includes("nintendo")) return "switch";
  if (value.includes("xbox") || value.includes("xinput")) return "xbox";
  return "generic";
}

export function useGamepad(
  onAction: (action: AppAction) => void,
  onAnyInput?: () => boolean,
): ControllerState {
  const callbackRef = useRef(onAction);
  const anyInputRef = useRef(onAnyInput);
  const pressedRef = useRef(new Map<string, boolean>());
  const repeatRef = useRef(new Map<string, number>());
  const rawInputPressedRef = useRef(false);
  const triggerChordLatchedRef = useRef(false);
  const triggerPressedAtRef = useRef<[number | null, number | null]>([null, null]);
  const triggerInputSuppressedRef = useRef(false);
  const activeZoomTriggerRef = useRef<-1 | 0 | 1>(0);
  const shoulderChordLatchedRef = useRef(false);
  const shoulderPressedAtRef = useRef<[number | null, number | null]>([null, null]);
  const shoulderInputSuppressedRef = useRef(false);
  const [state, setState] = useState<ControllerState>({ connected: false, name: "", layout: "generic" });

  callbackRef.current = onAction;
  anyInputRef.current = onAnyInput;

  useEffect(() => {
    let frame = 0;
    let lastControllerId = "";

    const emit = (key: string, pressed: boolean, action: AppAction, repeating = false, suppressed = false) => {
      const wasPressed = pressedRef.current.get(key) ?? false;
      const now = performance.now();
      const nextRepeat = repeatRef.current.get(key) ?? 0;
      if (pressed && (!wasPressed || (repeating && now >= nextRepeat))) {
        if (!suppressed) callbackRef.current(action);
        repeatRef.current.set(key, wasPressed ? now + 110 : now + 360);
      }
      pressedRef.current.set(key, pressed);
      if (!pressed) repeatRef.current.delete(key);
    };

    const poll = () => {
      const gamepad = Array.from(navigator.getGamepads()).find(Boolean);
      if (!gamepad) {
        if (lastControllerId) {
          if (activeZoomTriggerRef.current !== 0) callbackRef.current("zoomStop");
          lastControllerId = "";
          pressedRef.current.clear();
          rawInputPressedRef.current = false;
          triggerChordLatchedRef.current = false;
          triggerPressedAtRef.current = [null, null];
          triggerInputSuppressedRef.current = false;
          activeZoomTriggerRef.current = 0;
          shoulderChordLatchedRef.current = false;
          shoulderPressedAtRef.current = [null, null];
          shoulderInputSuppressedRef.current = false;
          setState({ connected: false, name: "", layout: "generic" });
        }
        frame = requestAnimationFrame(poll);
        return;
      }
      if (gamepad.id !== lastControllerId) {
        lastControllerId = gamepad.id;
        setState({ connected: true, name: gamepad.id, layout: controllerLayout(gamepad.id) });
      }

      const anyInputPressed = gamepad.buttons.some((button) => button.pressed)
        || gamepad.axes.some((axis) => Math.abs(axis) > 0.55);
      const suppressActions = anyInputPressed
        && !rawInputPressedRef.current
        && (anyInputRef.current?.() ?? false);
      rawInputPressedRef.current = anyInputPressed;

      const leftShoulderPressed = Boolean(gamepad.buttons[4]?.pressed);
      const rightShoulderPressed = Boolean(gamepad.buttons[5]?.pressed);
      const shoulderChordPressed = leftShoulderPressed && rightShoulderPressed;
      const shoulderNow = performance.now();
      if (leftShoulderPressed && shoulderPressedAtRef.current[0] === null) {
        shoulderPressedAtRef.current[0] = shoulderNow;
      } else if (!leftShoulderPressed) {
        shoulderPressedAtRef.current[0] = null;
      }
      if (rightShoulderPressed && shoulderPressedAtRef.current[1] === null) {
        shoulderPressedAtRef.current[1] = shoulderNow;
      } else if (!rightShoulderPressed) {
        shoulderPressedAtRef.current[1] = null;
      }
      if (suppressActions && (leftShoulderPressed || rightShoulderPressed)) {
        shoulderInputSuppressedRef.current = true;
      }
      if (shoulderChordPressed) shoulderChordLatchedRef.current = true;
      emit("shoulder-screenshot", shoulderChordPressed, "captureScreenshot", false, suppressActions);

      const suppressShoulderActions = shoulderChordLatchedRef.current || shoulderInputSuppressedRef.current;
      const leftShoulderReady = leftShoulderPressed
        && !rightShoulderPressed
        && shoulderPressedAtRef.current[0] !== null
        && shoulderNow - shoulderPressedAtRef.current[0] >= SHOULDER_CHORD_GRACE_MS;
      const rightShoulderReady = rightShoulderPressed
        && !leftShoulderPressed
        && shoulderPressedAtRef.current[1] !== null
        && shoulderNow - shoulderPressedAtRef.current[1] >= SHOULDER_CHORD_GRACE_MS;
      emit("button-4", leftShoulderReady, "seekBackward", false, suppressShoulderActions);
      emit("button-5", rightShoulderReady, "seekForward", false, suppressShoulderActions);

      const leftTriggerPressed = Boolean(gamepad.buttons[6]?.pressed);
      const rightTriggerPressed = Boolean(gamepad.buttons[7]?.pressed);
      const triggerChordPressed = leftTriggerPressed && rightTriggerPressed;
      const triggerNow = performance.now();
      if (leftTriggerPressed && triggerPressedAtRef.current[0] === null) {
        triggerPressedAtRef.current[0] = triggerNow;
      } else if (!leftTriggerPressed) {
        triggerPressedAtRef.current[0] = null;
      }
      if (rightTriggerPressed && triggerPressedAtRef.current[1] === null) {
        triggerPressedAtRef.current[1] = triggerNow;
      } else if (!rightTriggerPressed) {
        triggerPressedAtRef.current[1] = null;
      }
      if (suppressActions && (leftTriggerPressed || rightTriggerPressed)) {
        triggerInputSuppressedRef.current = true;
      }
      if (triggerChordPressed) triggerChordLatchedRef.current = true;
      emit("trigger-help", triggerChordPressed, "toggleHelp", false, suppressActions);

      const suppressTriggerActions = triggerChordLatchedRef.current || triggerInputSuppressedRef.current;
      const leftTriggerReady = leftTriggerPressed
        && !rightTriggerPressed
        && triggerPressedAtRef.current[0] !== null
        && triggerNow - triggerPressedAtRef.current[0] >= TRIGGER_CHORD_GRACE_MS;
      const rightTriggerReady = rightTriggerPressed
        && !leftTriggerPressed
        && triggerPressedAtRef.current[1] !== null
        && triggerNow - triggerPressedAtRef.current[1] >= TRIGGER_CHORD_GRACE_MS;
      emit("button-6", leftTriggerReady, "volumeDown", false, suppressTriggerActions);
      emit("button-7", rightTriggerReady, "volumeUp", false, suppressTriggerActions);

      const nextZoomTrigger = suppressTriggerActions ? 0 : leftTriggerReady ? -1 : rightTriggerReady ? 1 : 0;
      if (nextZoomTrigger !== activeZoomTriggerRef.current) {
        if (activeZoomTriggerRef.current !== 0) callbackRef.current("zoomStop");
        if (nextZoomTrigger < 0) callbackRef.current("zoomOutStart");
        else if (nextZoomTrigger > 0) callbackRef.current("zoomInStart");
        activeZoomTriggerRef.current = nextZoomTrigger;
      }

      Object.entries(BUTTON_ACTIONS).forEach(([buttonIndex, action]) => {
        if (!action) return;
        const index = Number(buttonIndex);
        const pressed = Boolean(gamepad.buttons[index]?.pressed);
        emit(
          `button-${index}`,
          pressed,
          action,
          action === "up" || action === "down" || action === "left" || action === "right",
          suppressActions,
        );
      });
      emit("axis-up", (gamepad.axes[1] ?? 0) < -0.55, "up", true, suppressActions);
      emit("axis-down", (gamepad.axes[1] ?? 0) > 0.55, "down", true, suppressActions);
      emit("axis-left", (gamepad.axes[0] ?? 0) < -0.55, "left", true, suppressActions);
      emit("axis-right", (gamepad.axes[0] ?? 0) > 0.55, "right", true, suppressActions);
      emit("axis-rate-down", (gamepad.axes[2] ?? 0) < -0.65, "playbackRateDown", true, suppressActions);
      emit("axis-rate-up", (gamepad.axes[2] ?? 0) > 0.65, "playbackRateUp", true, suppressActions);
      emit("axis-secondary-left", (gamepad.axes[2] ?? 0) < -0.65, "secondaryLeft", true, suppressActions);
      emit("axis-secondary-right", (gamepad.axes[2] ?? 0) > 0.65, "secondaryRight", true, suppressActions);
      emit("axis-secondary-up", (gamepad.axes[3] ?? 0) < -0.65, "secondaryUp", true, suppressActions);
      emit("axis-secondary-down", (gamepad.axes[3] ?? 0) > 0.65, "secondaryDown", true, suppressActions);
      if (!leftTriggerPressed && !rightTriggerPressed) {
        triggerChordLatchedRef.current = false;
        triggerInputSuppressedRef.current = false;
      }
      if (!leftShoulderPressed && !rightShoulderPressed) {
        shoulderChordLatchedRef.current = false;
        shoulderInputSuppressedRef.current = false;
      }
      frame = requestAnimationFrame(poll);
    };

    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, []);

  return state;
}
