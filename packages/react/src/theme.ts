/**
 * UI theme tokens for chart component chrome (text, tooltips, borders, axes).
 * Data-encoding colors (shot outcomes, pass types, heatmap scales) live in
 * the compute layer (src/compute/) and are NOT part of the UI theme.
 */
export type UITheme = {
  accent: {
    blue: string;
    red: string;
    green: string;
    purple: string;
    orange: string;
    yellow: string;
    slate: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    badge: string;
  };
  surface: {
    frame: string;
    tooltip: string;
    plot: string;
    badge: string;
  };
  border: {
    tooltip: string;
    subtle: string;
    badge: string;
  };
  shadow: {
    tooltip: string;
  };
  radius: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  focus: {
    ring: string;
    width: number;
    offset: number;
  };
  axis: {
    line: string;
    tick: string;
    grid: string;
    label: string;
  };
  /**
   * Foreground colours for marks drawn over data-coloured backgrounds
   * (heatmap cells, KDE surfaces, tactical zones). Charts pass these to
   * `pickContrast(bg, [theme.contrast.onLight, theme.contrast.onDark])`
   * so each mark picks the higher-contrast option per bin.
   *
   * `halo.*` are stroke colours used when a mark wants the cartographic
   * paint-order halo (a thin contrasting outline around the mark — works
   * against any background regardless of luminance).
   */
  contrast: {
    /** Foreground that pairs well with light backgrounds. */
    onLight: string;
    /** Foreground that pairs well with dark backgrounds. */
    onDark: string;
    halo: {
      /** Halo colour for marks rendered onLight. */
      onLight: string;
      /** Halo colour for marks rendered onDark. */
      onDark: string;
    };
  };
};

export const LIGHT_THEME: UITheme = {
  accent: {
    blue: "#2563eb",
    red: "#dc2626",
    green: "#16a34a",
    purple: "#7c3aed",
    orange: "#ea580c",
    yellow: "#f5c518",
    slate: "#64748b",
  },
  text: {
    primary: "#1a1a1a",
    secondary: "#6b7280",
    muted: "#9ca3af",
    badge: "#1a1a1a",
  },
  surface: {
    frame: "transparent",
    tooltip: "rgba(255, 255, 255, 0.96)",
    plot: "#ffffff",
    badge: "rgba(255, 255, 255, 0.96)",
  },
  border: {
    tooltip: "#d1d5db",
    subtle: "#e5e7eb",
    badge: "#d1d5db",
  },
  shadow: {
    tooltip: "0 4px 12px rgba(0, 0, 0, 0.1)",
  },
  radius: {
    xs: 2,
    sm: 4,
    md: 6,
    lg: 10,
    xl: 12,
    pill: 999,
  },
  focus: {
    ring: "#0f172a",
    width: 2,
    offset: -1,
  },
  axis: {
    line: "#9ca3af",
    tick: "#9ca3af",
    grid: "#e5e7eb",
    label: "#6b7280",
  },
  contrast: {
    onLight: "#0f172a",
    onDark: "#ffffff",
    halo: {
      onLight: "rgba(255, 255, 255, 0.85)",
      onDark: "rgba(15, 23, 42, 0.85)",
    },
  },
};

export const DARK_THEME: UITheme = {
  accent: {
    blue: "#60a5fa",
    red: "#f87171",
    green: "#4ade80",
    purple: "#a78bfa",
    orange: "#fb923c",
    yellow: "#facc15",
    slate: "#cbd5e1",
  },
  text: {
    primary: "#f5f5f7",
    secondary: "#9ea3ad",
    muted: "#93a0b6",
    badge: "#f5f5f7",
  },
  surface: {
    frame: "transparent",
    tooltip: "rgba(12, 16, 24, 0.95)",
    plot: "#0d1118",
    badge: "rgba(12, 16, 24, 0.95)",
  },
  border: {
    tooltip: "rgba(255, 255, 255, 0.12)",
    subtle: "#2a2e38",
    badge: "rgba(255, 255, 255, 0.12)",
  },
  shadow: {
    tooltip: "0 10px 30px rgba(0, 0, 0, 0.25)",
  },
  radius: {
    xs: 2,
    sm: 4,
    md: 6,
    lg: 10,
    xl: 12,
    pill: 999,
  },
  focus: {
    ring: "#f5f5f7",
    width: 2,
    offset: -1,
  },
  axis: {
    line: "#5a6577",
    tick: "#5a6577",
    grid: "#2a3446",
    label: "#93a0b6",
  },
  contrast: {
    onLight: "#0f172a",
    onDark: "#f5f5f7",
    halo: {
      onLight: "rgba(245, 245, 247, 0.9)",
      onDark: "rgba(13, 17, 24, 0.9)",
    },
  },
};
