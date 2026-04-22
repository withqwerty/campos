import type sharp from "sharp";
import { renderToStaticMarkup } from "react-dom/server";

import { StaticExportSvg, type ExportFrameSpec } from "@withqwerty/campos-react";

export type { ExportFrameSpec } from "@withqwerty/campos-react";

type SharpFactory = typeof sharp;

function resolveSharpFactory(moduleValue: unknown): SharpFactory {
  if (
    typeof moduleValue === "object" &&
    moduleValue != null &&
    "default" in moduleValue &&
    typeof (moduleValue as { default?: unknown }).default === "function"
  ) {
    return (moduleValue as { default: SharpFactory }).default;
  }

  return moduleValue as SharpFactory;
}

export function renderStaticSvg(spec: ExportFrameSpec): string {
  return `<?xml version="1.0" encoding="UTF-8"?>${renderToStaticMarkup(
    <StaticExportSvg spec={spec} />,
  )}`;
}

export async function renderStaticPng(spec: ExportFrameSpec): Promise<Buffer> {
  let sharpFactory: SharpFactory;

  try {
    sharpFactory = resolveSharpFactory(await import("sharp"));
  } catch (error) {
    throw new Error(
      "renderStaticPng() requires the optional sharp dependency to be installed",
      { cause: error },
    );
  }

  return sharpFactory(Buffer.from(renderStaticSvg(spec)))
    .png()
    .toBuffer();
}
