import { createContext, useContext } from "react";

import { LIGHT_THEME, type UITheme } from "./theme.js";

const ThemeContext = createContext<UITheme>(LIGHT_THEME);

export const ThemeProvider = ThemeContext.Provider;

export function useTheme(): UITheme {
  return useContext(ThemeContext);
}
