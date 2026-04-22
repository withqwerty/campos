import type { UITheme } from "../theme.js";

/**
 * Shared empty-state pill overlay used by all chart types.
 */
export function EmptyState({ message, theme }: { message: string; theme: UITheme }) {
  return (
    <div
      data-slot="empty-state"
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
      }}
    >
      <span
        style={{
          padding: "4px 12px",
          borderRadius: theme.radius.md,
          fontSize: 13,
          color: theme.text.secondary,
          background: theme.surface.badge,
          border: `1px solid ${theme.border.badge}`,
          boxShadow: theme.shadow.tooltip,
        }}
      >
        {message}
      </span>
    </div>
  );
}
