export function directoryName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const separatorIndex = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
  if (separatorIndex < 0) return ".";

  const parent = trimmed.slice(0, separatorIndex);
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}\\`;
  return parent || "/";
}
