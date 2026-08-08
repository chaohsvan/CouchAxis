import type { ApplicationShortcut } from "../types";

export function bindApplicationShortcut(
  shortcuts: ApplicationShortcut[],
  shortcut: ApplicationShortcut,
): ApplicationShortcut[] {
  const path = shortcut.path.trim();
  if (!path) return shortcuts;
  return [
    ...shortcuts.filter((entry) => entry.path.toLowerCase() !== path.toLowerCase()),
    { ...shortcut, path },
  ];
}

export function removeApplicationShortcut(
  shortcuts: ApplicationShortcut[],
  path: string,
): ApplicationShortcut[] {
  return shortcuts.filter((entry) => entry.path.toLowerCase() !== path.toLowerCase());
}
