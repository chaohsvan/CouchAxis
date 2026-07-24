import { Gamepad2, X } from "lucide-react";
import { useI18n } from "../i18n";
import { CONTROLLER_HELP_ITEMS, type ControllerHelpContext, type ControllerHelpControl } from "../lib/controllerHelp";
import type { ControllerLayout } from "../types";

interface ControllerHelpOverlayProps {
  context: ControllerHelpContext;
  layout: ControllerLayout;
  onClose: () => void;
}

interface ControllerLabels {
  confirm: string;
  back: string;
  alternate: string;
  top: string;
  leftShoulder: string;
  rightShoulder: string;
  leftTrigger: string;
  rightTrigger: string;
  select: string;
  start: string;
}

const LAYOUT_LABELS: Record<ControllerLayout, ControllerLabels> = {
  xbox: {
    confirm: "A", back: "B", alternate: "X", top: "Y",
    leftShoulder: "LB", rightShoulder: "RB", leftTrigger: "LT", rightTrigger: "RT",
    select: "View", start: "Menu",
  },
  playstation: {
    confirm: "×", back: "○", alternate: "□", top: "△",
    leftShoulder: "L1", rightShoulder: "R1", leftTrigger: "L2", rightTrigger: "R2",
    select: "Create", start: "Options",
  },
  switch: {
    confirm: "B", back: "A", alternate: "Y", top: "X",
    leftShoulder: "L", rightShoulder: "R", leftTrigger: "ZL", rightTrigger: "ZR",
    select: "−", start: "+",
  },
  generic: {
    confirm: "1", back: "2", alternate: "3", top: "4",
    leftShoulder: "L1", rightShoulder: "R1", leftTrigger: "L2", rightTrigger: "R2",
    select: "Select", start: "Start",
  },
};

function controlLabel(control: ControllerHelpControl, labels: ControllerLabels): string {
  const fixed: Partial<Record<ControllerHelpControl, string>> = {
    vertical: "L / D-Pad ↑↓",
    horizontal: "L / D-Pad ←→",
    previousDirections: "L / D-Pad ↑←",
    nextDirections: "L / D-Pad ↓→",
    leftStickClick: "L3",
    rightStickClick: "R3",
    rightStickHorizontal: "R ←→",
    rightStickAll: "R ↕↔",
  };
  if (fixed[control]) return fixed[control];
  if (control === "shoulderChord") return `${labels.leftShoulder} + ${labels.rightShoulder}`;
  if (control === "triggerChord") return `${labels.leftTrigger} + ${labels.rightTrigger}`;
  return labels[control as keyof ControllerLabels];
}

export function ControllerHelpOverlay({ context, layout, onClose }: ControllerHelpOverlayProps) {
  const { t } = useI18n();
  const labels = LAYOUT_LABELS[layout];

  return (
    <div
      className="controller-help-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="controller-help" role="dialog" aria-modal="true" aria-labelledby="controller-help-title">
        <header className="controller-help-header">
          <div className="controller-help-mark"><Gamepad2 aria-hidden="true" /></div>
          <div>
            <span>{t(`help.context.${context}`)}</span>
            <h2 id="controller-help-title">{t("help.title")}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title={t("help.close")} aria-label={t("help.close")}>
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="controller-help-grid">
          {CONTROLLER_HELP_ITEMS[context].map((item, index) => (
            <div className="controller-help-row" key={`${item.description}-${index}`}>
              <div className="controller-help-buttons">
                {item.controls.map((control) => (
                  <kbd className={control === "triggerChord" ? "controller-key combo" : "controller-key"} key={control}>
                    {controlLabel(control, labels)}
                  </kbd>
                ))}
              </div>
              <span>{t(item.description)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
