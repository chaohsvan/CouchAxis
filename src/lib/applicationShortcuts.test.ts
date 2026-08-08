import { describe, expect, it } from "vitest";
import { bindApplicationShortcut, removeApplicationShortcut } from "./applicationShortcuts";

describe("application shortcuts", () => {
  it("deduplicates paths case-insensitively and keeps the latest name", () => {
    const shortcuts = bindApplicationShortcut(
      [{ name: "Old", path: "C:\\Tools\\Player.exe", runAsAdministrator: false }],
      { name: "Player", path: "c:\\tools\\PLAYER.EXE", runAsAdministrator: true },
    );

    expect(shortcuts).toEqual([{
      name: "Player",
      path: "c:\\tools\\PLAYER.EXE",
      runAsAdministrator: true,
    }]);
  });

  it("removes a bound application by path", () => {
    expect(removeApplicationShortcut(
      [{ name: "Player", path: "C:\\Tools\\Player.exe", runAsAdministrator: false }],
      "c:\\tools\\player.exe",
    )).toEqual([]);
  });
});
