import { useState, useRef, useCallback, type ReactNode } from "react";

import { LIGHT_THEME, type UITheme } from "../theme.js";

export type CursorTooltipApi = {
  /** Ref to attach to the container element. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Show tooltip at the cursor position with the given content. */
  show: (e: React.MouseEvent, content: ReactNode) => void;
  /** Hide the tooltip. */
  hide: () => void;
  /** The tooltip element — render this inside the container. */
  element: ReactNode;
};

/**
 * Hook that provides a cursor-following tooltip for any container.
 *
 * ```tsx
 * function MyChart() {
 *   const tooltip = useCursorTooltip();
 *   return (
 *     <div ref={tooltip.containerRef} style={{ position: "relative" }}>
 *       <svg onMouseMove={(e) => tooltip.show(e, <span>Hello</span>)}
 *            onMouseLeave={tooltip.hide}>
 *         ...
 *       </svg>
 *       {tooltip.element}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCursorTooltip(theme: UITheme = LIGHT_THEME): CursorTooltipApi {
  const [state, setState] = useState<{
    x: number;
    y: number;
    content: ReactNode;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const show = useCallback((e: React.MouseEvent, content: ReactNode) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setState({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      content,
    });
  }, []);

  const hide = useCallback(() => {
    setState(null);
  }, []);

  const element = state ? (
    <div
      data-testid="cursor-tooltip"
      style={{
        position: "absolute",
        left: state.x + 10,
        top: state.y - 8,
        transform: "translateY(-100%)",
        background: theme.surface.tooltip,
        color: theme.text.primary,
        fontSize: 11,
        lineHeight: 1.4,
        padding: "5px 9px",
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.border.tooltip}`,
        boxShadow: theme.shadow.tooltip,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 20,
        maxWidth: 260,
      }}
    >
      {state.content}
    </div>
  ) : null;

  return { containerRef, show, hide, element };
}
