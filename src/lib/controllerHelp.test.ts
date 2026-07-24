import { describe, expect, it } from "vitest";
import { CONTROLLER_HELP_ITEMS } from "./controllerHelp";

describe("controller help mappings", () => {
  it("uses page-specific mappings and exposes the trigger chord everywhere", () => {
    const contexts = Object.keys(CONTROLLER_HELP_ITEMS) as Array<keyof typeof CONTROLLER_HELP_ITEMS>;
    const descriptions = contexts.map((context) => CONTROLLER_HELP_ITEMS[context].map((item) => item.description));

    descriptions.forEach((items) => expect(items).toContain("help.action.toggleHelp"));
    expect(descriptions[contexts.indexOf("browser")]).toContain("help.action.favorite");
    expect(descriptions[contexts.indexOf("audio")]).toContain("help.action.spectrum");
    expect(descriptions[contexts.indexOf("video")]).toContain("help.action.subtitle");
    expect(descriptions[contexts.indexOf("video")]).toContain("help.action.screenshot");
    expect(descriptions[contexts.indexOf("video")]).toContain("help.action.playbackRate");
    expect(descriptions[contexts.indexOf("video")]).toContain("help.action.focusMode");
    expect(descriptions[contexts.indexOf("image")]).toContain("help.action.panImage");
    expect(descriptions[contexts.indexOf("image")]).toContain("help.action.scaleLock");
    expect(descriptions[contexts.indexOf("image")]).toContain("help.action.focusMode");
    expect(descriptions[contexts.indexOf("folder")]).toContain("help.action.openOrChooseFolder");
    expect(descriptions[contexts.indexOf("subtitle")]).not.toContain("help.action.fullscreen");
  });
});
