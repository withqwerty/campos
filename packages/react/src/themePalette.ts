import type { UITheme } from "./theme.js";

export type ThemePalette =
  | readonly string[]
  | ((theme: UITheme) => readonly string[] | undefined);

export function resolveThemePalette(
  palette: ThemePalette | undefined,
  theme: UITheme,
): readonly string[] | undefined {
  if (palette == null) {
    return undefined;
  }
  return typeof palette === "function" ? palette(theme) : palette;
}
