import { describe, expect, it } from "vitest";
import { translate } from "./i18n";

describe("interface translations", () => {
  it("translates labels and interpolates values", () => {
    expect(translate("zh-CN", "browser.items", { count: 3 })).toBe("3 项");
    expect(translate("en-US", "browser.items", { count: 3 })).toBe("3 items");
    expect(translate("en-US", "nav.localDisk", { drive: "D:" })).toBe("Local Disk (D:)");
    expect(translate("zh-CN", "player.screenshotSaved", { name: "frame.png" })).toBe("截图已保存：frame.png");
    expect(translate("en-US", "subtitle.none")).toBe("No subtitles");
  });
});
