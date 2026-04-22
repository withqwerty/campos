import { Fragment, type ReactElement, type ReactNode } from "react";

import {
  defaultCustomCellSize,
  estimateSmallPillWidth,
  lookupCellSize,
  markerPillCellHeight,
  type SlotItemSpec,
} from "../primitives/index.js";
import type { MarkerSlotContent } from "../Formation.js";

/**
 * Convert a user-supplied slot content (single node, array, fragment,
 * string, number, or falsy) into the flat SlotItemSpec[] the layout
 * engine consumes.
 */
export function normaliseSlotContent(
  content: MarkerSlotContent,
  r: number,
): SlotItemSpec[] {
  const out: SlotItemSpec[] = [];
  collectSlotItems(content, r, out);
  return out;
}

function collectSlotItems(content: ReactNode, r: number, out: SlotItemSpec[]): void {
  if (content == null || content === false || content === true) return;
  if (Array.isArray(content)) {
    for (const child of content) collectSlotItems(child as ReactNode, r, out);
    return;
  }
  if (
    typeof content === "object" &&
    "type" in content &&
    (content as ReactElement).type === Fragment
  ) {
    const fragmentChildren = (content as ReactElement<{ children?: ReactNode }>).props
      .children;
    collectSlotItems(fragmentChildren, r, out);
    return;
  }
  const size = measureSlotItem(content, r);
  out.push({ node: content, cellWidth: size.cellWidth, cellHeight: size.cellHeight });
}

function measureSlotItem(
  node: ReactNode,
  r: number,
): { cellWidth: number; cellHeight: number } {
  if (typeof node === "string" || typeof node === "number") {
    const text = String(node);
    return {
      cellWidth: estimateSmallPillWidth(r, text),
      cellHeight: markerPillCellHeight(r),
    };
  }
  const fn = lookupCellSize(node);
  if (fn != null) {
    const elementProps = (node as ReactElement<Record<string, unknown>>).props;
    return fn(elementProps, r);
  }
  warnUnmeasurableSlotItem(node);
  return defaultCustomCellSize(r);
}

const warnedUnmeasurable = new WeakSet();

function warnUnmeasurableSlotItem(node: ReactNode): void {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return;
  }
  if (typeof node !== "object" || node == null) return;
  if (warnedUnmeasurable.has(node)) return;
  warnedUnmeasurable.add(node);
  const t = (node as ReactElement).type;
  const name =
    typeof t === "function"
      ? ((t as { displayName?: string; name?: string }).displayName ??
        (t as { name?: string }).name ??
        "anonymous")
      : typeof t === "string"
        ? t
        : "non-component";
  console.warn(
    `[campos] Formation marker slot item <${name}/> has no cell-size protocol registration; ` +
      `falling back to a default r × r square. Wrap with MarkerIcon / MarkerPill / RatingPill, ` +
      `or call registerCellSize() from "@withqwerty/campos-react" to opt in.`,
  );
}
