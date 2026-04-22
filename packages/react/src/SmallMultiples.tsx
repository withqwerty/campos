import { Component, type CSSProperties, type ReactElement, type ReactNode } from "react";

import type { SharedPitchScale } from "./compute/shared-pitch-scale.js";
export type { SharedPitchScale } from "./compute/shared-pitch-scale.js";

export type SmallMultiplesView = {
  pitchOrientation?: "horizontal" | "vertical";
  pitchCrop?: "full" | "half";
  sharedScale?: SharedPitchScale;
};

export type SmallMultiplesProps<T> = {
  items: ReadonlyArray<T> | null | undefined;
  getItemKey: (item: T, index: number) => string | number;
  renderCell: (item: T, index: number, view: SmallMultiplesView) => ReactNode;
  renderLabel?: (item: T, index: number) => ReactNode;
  columns?: number | { minCellWidth: number };
  gap?: number;
  labelPlacement?: "above" | "below";
  onCellError?: (error: Error, item: T, index: number) => void;
  ariaLabel?: string;
  emptyState?: ReactNode;
  pitchOrientation?: "horizontal" | "vertical";
  pitchCrop?: "full" | "half";
  sharedScale?: SharedPitchScale;
};

export type CellLabelProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  caption?: ReactNode;
  ariaLabel?: string;
};

type CellErrorBoundaryProps = {
  resetKey: string | number;
  onError?: (error: Error) => void;
  children: ReactNode;
};

type CellErrorBoundaryState = {
  hasError: boolean;
};

const DEFAULT_ARIA_LABEL = "Small multiples grid";
const DEFAULT_GAP = 16;
const DEFAULT_MIN_CELL_WIDTH = 240;
const MIN_CELL_WIDTH_FLOOR = 120;

const CELL_LABEL_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.125rem",
  minWidth: 0,
};

const CELL_LABEL_EYEBROW_STYLE: CSSProperties = {
  fontSize: "0.6875rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--muted, #6b7280)",
  lineHeight: 1.3,
};

const CELL_LABEL_TITLE_STYLE: CSSProperties = {
  fontSize: "0.9375rem",
  fontWeight: 700,
  color: "var(--ink, #111827)",
  fontVariantNumeric: "tabular-nums",
  overflowWrap: "anywhere",
};

const CELL_LABEL_CAPTION_STYLE: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--muted, #6b7280)",
  lineHeight: 1.3,
  fontVariantNumeric: "tabular-nums",
  overflowWrap: "anywhere",
};

const GRID_SECTION_BASE_STYLE: CSSProperties = {
  width: "100%",
};

const FIGURE_STYLE: CSSProperties = {
  margin: 0,
  minWidth: 0,
  overflow: "hidden",
  display: "grid",
  gap: "0.625rem",
  alignContent: "start",
};

const CONTENT_WRAPPER_STYLE: CSSProperties = {
  minWidth: 0,
};

const EMPTY_STATE_STYLE: CSSProperties = {
  width: "100%",
  border: "1px dashed var(--border, #d1d5db)",
  borderRadius: 16,
  padding: "1rem 1.1rem",
  color: "var(--muted, #6b7280)",
  background: "rgba(255,255,255,0.72)",
};

const ERROR_PLACEHOLDER_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "8rem",
  border: "1px solid rgba(239,68,68,0.45)",
  borderRadius: 12,
  padding: "0.875rem",
  color: "var(--muted, #6b7280)",
  background: "rgba(254,242,242,0.75)",
  fontSize: "0.8125rem",
  textAlign: "center",
};

function isAbsentNode(node: ReactNode): boolean {
  return node == null || typeof node === "boolean";
}

function deriveAriaLabel(node: ReactNode): string | undefined {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  return undefined;
}

function normalizePositiveNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function buildGridStyle(
  columns: SmallMultiplesProps<unknown>["columns"],
  gap: number,
): CSSProperties {
  const safeGap = Math.max(0, gap);
  if (typeof columns === "number") {
    return {
      display: "grid",
      gridTemplateColumns: `repeat(${Math.max(1, Math.round(columns))}, minmax(0, 1fr))`,
      gap: `${safeGap}px`,
    };
  }

  const minCellWidth = Math.max(
    MIN_CELL_WIDTH_FLOOR,
    normalizePositiveNumber(
      columns?.minCellWidth ?? DEFAULT_MIN_CELL_WIDTH,
      DEFAULT_MIN_CELL_WIDTH,
    ),
  );

  return {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fill, minmax(${minCellWidth}px, 1fr))`,
    gap: `${safeGap}px`,
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function reportCellError(error: unknown, onError?: (error: Error) => void): void {
  const normalizedError = toError(error);
  if (onError == null) {
    console.error(normalizedError);
    return;
  }

  try {
    onError(normalizedError);
  } catch (reporterError) {
    console.error("[SmallMultiples] original cell error:", normalizedError);
    console.error("[SmallMultiples] onCellError reporter threw:", reporterError);
  }
}

function renderDefaultEmptyState() {
  return <p style={{ margin: 0 }}>No items to compare.</p>;
}

export function CellLabel({
  title,
  eyebrow,
  caption,
  ariaLabel,
}: CellLabelProps): ReactElement {
  return (
    <div style={CELL_LABEL_STYLE} aria-label={ariaLabel ?? deriveAriaLabel(title)}>
      {!isAbsentNode(eyebrow) ? (
        <span data-slot="eyebrow" style={CELL_LABEL_EYEBROW_STYLE}>
          {eyebrow}
        </span>
      ) : null}
      <span data-slot="title" style={CELL_LABEL_TITLE_STYLE}>
        {title}
      </span>
      {!isAbsentNode(caption) ? (
        <span data-slot="caption" style={CELL_LABEL_CAPTION_STYLE}>
          {caption}
        </span>
      ) : null}
    </div>
  );
}

class CellErrorBoundary extends Component<
  CellErrorBoundaryProps,
  CellErrorBoundaryState
> {
  state: CellErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CellErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    reportCellError(error, this.props.onError);
  }

  componentDidUpdate(prevProps: CellErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div data-campos-cell-error="true" style={ERROR_PLACEHOLDER_STYLE}>
          Unable to render this cell.
        </div>
      );
    }
    return this.props.children;
  }
}

export function SmallMultiples<T>({
  items,
  getItemKey,
  renderCell,
  renderLabel,
  columns,
  gap = DEFAULT_GAP,
  labelPlacement = "above",
  onCellError,
  ariaLabel = DEFAULT_ARIA_LABEL,
  emptyState,
  pitchOrientation,
  pitchCrop,
  sharedScale,
}: SmallMultiplesProps<T>): ReactElement {
  const safeItems = items ?? [];
  const view: SmallMultiplesView = {
    ...(pitchOrientation != null ? { pitchOrientation } : {}),
    ...(pitchCrop != null ? { pitchCrop } : {}),
    ...(sharedScale != null ? { sharedScale } : {}),
  };

  if (
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    safeItems.length > 0 &&
    safeItems.length <= 500
  ) {
    const seen = new Map<string | number, number>();
    safeItems.forEach((item, index) => {
      const key = getItemKey(item, index);
      const previousIndex = seen.get(key);
      if (previousIndex != null) {
        console.error(
          `[SmallMultiples] getItemKey returned duplicate key "${String(
            key,
          )}" for items at indices ${previousIndex} and ${index}. Error recovery will be incorrect for these items.`,
        );
      }
      seen.set(key, index);
    });
  }

  if (safeItems.length === 0) {
    return (
      <section
        role="region"
        aria-label={ariaLabel}
        data-testid="smallmultiples-grid"
        data-empty="true"
        style={GRID_SECTION_BASE_STYLE}
      >
        <div style={EMPTY_STATE_STYLE}>{emptyState ?? renderDefaultEmptyState()}</div>
      </section>
    );
  }

  const gridStyle = buildGridStyle(columns, gap);

  return (
    <section
      role="region"
      aria-label={ariaLabel}
      data-testid="smallmultiples-grid"
      style={{ ...GRID_SECTION_BASE_STYLE, ...gridStyle }}
    >
      {safeItems.map((item, index) => {
        const key = getItemKey(item, index);
        const handleCellError =
          onCellError != null
            ? (error: Error) => {
                onCellError(error, item, index);
              }
            : undefined;

        let cellNode: ReactNode;
        try {
          cellNode = renderCell(item, index, view);
        } catch (error) {
          reportCellError(error, handleCellError);
          const erroredLabel = renderLabel?.(item, index);
          return (
            <figure key={key} data-campos-cell-error="true" style={FIGURE_STYLE}>
              {labelPlacement === "above" && !isAbsentNode(erroredLabel) ? (
                <figcaption>{erroredLabel}</figcaption>
              ) : null}
              <div style={ERROR_PLACEHOLDER_STYLE}>Unable to render this cell.</div>
              {labelPlacement === "below" && !isAbsentNode(erroredLabel) ? (
                <figcaption>{erroredLabel}</figcaption>
              ) : null}
            </figure>
          );
        }

        const labelNode = renderLabel?.(item, index);
        const showLabel = !isAbsentNode(labelNode);
        const isEmptyCell = isAbsentNode(cellNode);

        return (
          <figure
            key={key}
            {...(isEmptyCell ? { "data-campos-cell-empty": "true" } : {})}
            style={FIGURE_STYLE}
          >
            {labelPlacement === "above" && showLabel ? (
              <figcaption>{labelNode}</figcaption>
            ) : null}
            {!isEmptyCell ? (
              <div style={CONTENT_WRAPPER_STYLE}>
                <CellErrorBoundary
                  resetKey={key}
                  {...(handleCellError != null ? { onError: handleCellError } : {})}
                >
                  {cellNode}
                </CellErrorBoundary>
              </div>
            ) : null}
            {labelPlacement === "below" && showLabel ? (
              <figcaption>{labelNode}</figcaption>
            ) : null}
          </figure>
        );
      })}
    </section>
  );
}
