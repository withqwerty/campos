import { createLinearScale } from "./compute/scales/index.js";
import { formatDistributionDensity } from "./compute/distribution-chart.js";

export const DEFAULT_DISTRIBUTION_COLORS = [
  "#c4514f",
  "#3b98a7",
  "#6d5ba8",
  "#d58b2b",
  "#4b8a5f",
  "#7c4d79",
];

export function defaultDistributionColor(index: number): string {
  return (
    DEFAULT_DISTRIBUTION_COLORS[index % DEFAULT_DISTRIBUTION_COLORS.length] ?? "#4665d8"
  );
}

export function clampToDomain(value: number, domain: [number, number]): number {
  return Math.max(domain[0], Math.min(domain[1], value));
}

export function formatDistributionValue(
  value: number,
  formatter?: (value: number) => string,
) {
  return formatter != null ? formatter(value) : formatDistributionDensity(value);
}

export function createDistributionXScale(
  domain: [number, number],
  plotArea: { x: number; width: number },
) {
  return createLinearScale(domain, [plotArea.x, plotArea.x + plotArea.width]);
}

export function clientPointToSvgX(svg: SVGSVGElement, clientX: number, clientY: number) {
  if (typeof svg.createSVGPoint === "function") {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const inverse = svg.getScreenCTM()?.inverse();
    if (inverse != null) {
      return point.matrixTransform(inverse).x;
    }
  }

  const rect = svg.getBoundingClientRect();
  const svgViewBox = svg.viewBox.baseVal;
  const viewBox =
    typeof svgViewBox.width === "number" && svgViewBox.width > 0
      ? svgViewBox
      : { x: 0, width: rect.width };
  if (rect.width <= 0) {
    return viewBox.x;
  }
  return viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width;
}
