import { DARK_THEME, LIGHT_THEME, type UITheme } from "../theme.js";
import type {
  ExportBackgroundSpec,
  ExportBackgroundToken,
  ExportThemeName,
} from "./types.js";

const BACKGROUND_TOKEN_RESOLVERS: Record<
  ExportBackgroundToken,
  (theme: UITheme, themeName: ExportThemeName) => string
> = {
  canvas: (theme, themeName) =>
    themeName === "dark" ? DARK_THEME.surface.plot : LIGHT_THEME.surface.plot,
  surface: (theme) => theme.surface.plot,
};

export function resolveExportBackground(
  background: ExportBackgroundSpec,
  theme: UITheme,
  themeName: ExportThemeName,
): string {
  if (background.kind === "solid") {
    return background.color;
  }

  return BACKGROUND_TOKEN_RESOLVERS[background.token](theme, themeName);
}
