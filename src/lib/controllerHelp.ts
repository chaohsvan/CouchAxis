import type { TranslationKey } from "../i18n";

export type ControllerHelpContext = "browser" | "settings" | "folder" | "video" | "audio" | "image" | "subtitle";

export type ControllerHelpControl =
  | "vertical"
  | "horizontal"
  | "previousDirections"
  | "nextDirections"
  | "confirm"
  | "back"
  | "alternate"
  | "top"
  | "leftShoulder"
  | "rightShoulder"
  | "leftTrigger"
  | "rightTrigger"
  | "select"
  | "start"
  | "leftStickClick"
  | "rightStickClick"
  | "rightStickHorizontal"
  | "rightStickAll"
  | "shoulderChord"
  | "triggerChord";

export interface ControllerHelpItem {
  controls: ControllerHelpControl[];
  description: TranslationKey;
}

const sharedHelp: ControllerHelpItem = {
  controls: ["triggerChord"],
  description: "help.action.toggleHelp",
};

export const CONTROLLER_HELP_ITEMS: Record<ControllerHelpContext, ControllerHelpItem[]> = {
  browser: [
    { controls: ["vertical"], description: "help.action.moveSelection" },
    { controls: ["horizontal"], description: "help.action.switchRegion" },
    { controls: ["confirm"], description: "help.action.open" },
    { controls: ["back"], description: "help.action.parent" },
    { controls: ["top"], description: "help.action.favorite" },
    { controls: ["select"], description: "help.action.browserView" },
    { controls: ["start"], description: "help.action.fullscreen" },
    sharedHelp,
  ],
  settings: [
    { controls: ["vertical"], description: "help.action.selectSetting" },
    { controls: ["horizontal"], description: "help.action.changeSetting" },
    { controls: ["confirm"], description: "help.action.confirmSetting" },
    { controls: ["back"], description: "help.action.closeSettings" },
    sharedHelp,
  ],
  folder: [
    { controls: ["vertical"], description: "help.action.moveSelection" },
    { controls: ["confirm"], description: "help.action.openOrChooseFolder" },
    { controls: ["back"], description: "help.action.parentOrClose" },
    sharedHelp,
  ],
  video: [
    { controls: ["confirm", "alternate"], description: "help.action.playPause" },
    { controls: ["horizontal", "leftShoulder", "rightShoulder"], description: "help.action.seek" },
    { controls: ["rightStickHorizontal"], description: "help.action.playbackRate" },
    { controls: ["leftTrigger", "rightTrigger"], description: "help.action.volume" },
    { controls: ["shoulderChord"], description: "help.action.screenshot" },
    { controls: ["top"], description: "help.action.subtitle" },
    { controls: ["rightStickClick"], description: "help.action.focusMode" },
    { controls: ["start"], description: "help.action.fullscreen" },
    { controls: ["back"], description: "help.action.closePlayer" },
    sharedHelp,
  ],
  audio: [
    { controls: ["confirm", "alternate"], description: "help.action.playPause" },
    { controls: ["vertical"], description: "help.action.changeTrack" },
    { controls: ["horizontal", "leftShoulder", "rightShoulder"], description: "help.action.seek" },
    { controls: ["leftTrigger", "rightTrigger"], description: "help.action.volume" },
    { controls: ["top"], description: "help.action.playbackMode" },
    { controls: ["select"], description: "help.action.queue" },
    { controls: ["leftStickClick"], description: "help.action.spectrum" },
    { controls: ["rightStickClick"], description: "help.action.blackout" },
    { controls: ["start"], description: "help.action.fullscreen" },
    { controls: ["back"], description: "help.action.closePlayer" },
    sharedHelp,
  ],
  image: [
    { controls: ["previousDirections", "leftShoulder"], description: "help.action.previousImage" },
    { controls: ["nextDirections", "confirm", "rightShoulder"], description: "help.action.nextImage" },
    { controls: ["leftTrigger"], description: "help.action.zoomOut" },
    { controls: ["rightTrigger"], description: "help.action.zoomIn" },
    { controls: ["rightStickAll"], description: "help.action.panImage" },
    { controls: ["rightStickClick"], description: "help.action.focusMode" },
    { controls: ["select"], description: "help.action.scaleLock" },
    { controls: ["alternate"], description: "help.action.rotate" },
    { controls: ["top"], description: "help.action.resetImage" },
    { controls: ["start"], description: "help.action.fullscreen" },
    { controls: ["back"], description: "help.action.closeViewer" },
    sharedHelp,
  ],
  subtitle: [
    { controls: ["vertical"], description: "help.action.moveSelection" },
    { controls: ["confirm"], description: "help.action.chooseSubtitle" },
    { controls: ["back"], description: "help.action.closeSubtitle" },
    sharedHelp,
  ],
};
